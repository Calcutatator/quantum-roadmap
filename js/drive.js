/* ============================================================================
   drive.js — the scroll engine. Everything the eye sees is a pure function of
   one progress value p ∈ [0,1], so the drive is perfectly scrubbable and
   reversible. ScrollTrigger supplies p (and pins the stage); we smooth it in a
   ticker for a buttery feel without hijacking scroll. Exposes window.DRIVE.
   ========================================================================== */
(function () {
  "use strict";

  var M;                 // scene model from SCENE.build()
  var scene, stage, hero, finish, railFill, driveSection;
  var stageW = 0, stageH = 0, k = 1, vbH = 1000;
  var targetP = 0, currentP = 0;
  var S = 0.6;           // share of scroll spent driving (Zone A)
  var dock = false;      // narrow-screen: dock cards to the bottom
  var running = false;
  var hoveredIndex = -1; // sign currently hovered by the mouse (brightens)
  var snapPoints = [];   // progress values the scroll "sticks" to (each sign)
  var REACH_BAND = 130;  // world-units over which a sign changes colour as the car arrives
  var stRef = null;      // the ScrollTrigger instance (scroll <-> progress math)
  var lastInput = -1e9;  // ms of the last user scroll input (wheel/touch/key)
  var lastMove = -1e9;   // ms the scroll position last changed (covers momentum)
  var prevScroll = 0;    // last observed scroll position
  var snapping = false;  // currently easing the scroll onto a sign
  var snapTargetP = 0;   // progress we're sticking to
  var SNAP_IDLE_MS = 130;// pause after scrolling stops before it sticks

  /* --- easing --- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth01(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function setLamp(lamp, haloOp, coreOp) {
    if (!lamp) return;
    lamp.halo.setAttribute("opacity", clamp01(haloOp).toFixed(3));
    lamp.core.setAttribute("opacity", clamp01(coreOp).toFixed(3));
  }

  /* --- camera model ------------------------------------------------------- */
  // path fraction the CAMERA centres on. Linear within each zone so signs are
  // evenly spaced in scroll — every sticky point gets equal room. (The rAF
  // ticker still smooths currentP → targetP, so motion stays fluid.)
  function lookAtY(p) {
    if (p <= S) return lerp(M.carStartY, M.frontierY, p / S);
    return lerp(M.frontierY, M.destinationY, (p - S) / (1 - S));
  }
  // where the CAR sits (parks at the frontier once reached)
  function carY(p) {
    if (p <= S) return lerp(M.carStartY, M.frontierY, p / S);
    return M.frontierY;
  }

  function worldToScreenY(worldY, camTy) { return (worldY + camTy) * k; }

  /* --- dimensions --------------------------------------------------------- */
  function computeDims() {
    var r = stage.getBoundingClientRect();
    stageW = r.width || window.innerWidth;
    stageH = r.height || window.innerHeight;
    k = stageW / M.W;
    vbH = M.W * stageH / stageW;            // keeps slice == exact fill (no crop)
    scene.setAttribute("viewBox", "0 0 " + M.W + " " + vbH.toFixed(1));
    var wasDock = dock;
    dock = window.innerWidth < 760;
    document.documentElement.classList.toggle("layout-dock", dock);
    if (wasDock !== dock) { /* layout switch handled on next render */ }
  }

  /* --- the render (pure function of p) ------------------------------------ */
  function render(p, time) {
    var la = lookAtY(p);
    var cy = carY(p);
    var camTy = vbH / 2 - la;

    M.worldEl.setAttribute("transform", "translate(0," + camTy.toFixed(2) + ")");

    // car
    var cx = M.roadX(cy);
    var ang = M.roadAngle(cy);
    M.carEl.setAttribute("transform", "translate(" + cx.toFixed(2) + "," + cy.toFixed(2) + ") rotate(" + ang.toFixed(2) + ")");

    var centre = stageH / 2;
    var t = time || 0;

    // lights — colour is driven by the CAR's position relative to each sign:
    //   amber while ahead (not reached) · green once a "done" sign is passed ·
    //   red at the "current" frontier. The centred sign breathes; hover brightens.
    for (var i = 0; i < M.lights.length; i++) {
      var L = M.lights[i];
      var sy = worldToScreenY(L.y, camTy);
      var prox = clamp01(1 - Math.abs(sy - centre) / (stageH * 0.62));
      var reach = clamp01((cy - (L.y - REACH_BAND)) / REACH_BAND); // 0 = not reached, 1 = arrived/passed

      var hover = (i === hoveredIndex) ? 1 : 0;
      var breathe = 1 + 0.16 * prox * prox * Math.sin(t * 0.005);  // the stopped-at sign gently pulses
      var glow = (0.4 + 0.4 * prox) * breathe + hover * 0.45;      // visible off-centre, brighter centred/hovered
      var core = 0.35 + 0.45 * prox + hover * 0.25;

      if (L.lamps.green) {          // "done": amber → green as the car passes
        setLamp(L.lamps.amber, (1 - reach) * glow, (1 - reach) * core);
        setLamp(L.lamps.green, reach * glow, 0.25 + reach * core);
      } else if (L.lamps.red) {     // "current": amber → red as the car arrives
        setLamp(L.lamps.amber, (1 - reach) * glow, (1 - reach) * core);
        setLamp(L.lamps.red, reach * glow, 0.3 + reach * core);
        if (L.tag) L.tag.setAttribute("opacity", clamp01((reach - 0.25) / 0.5).toFixed(3));
      } else {                      // "upcoming": stays amber (never reached)
        setLamp(L.lamps.amber, glow, core);
      }
    }

    // copy cards
    var best = -1, bestProx = 0;
    for (var c = 0; c < M.cards.length; c++) {
      var cp = M.cps[c];
      var csy = worldToScreenY(cp.y, camTy);
      var cprox = clamp01(1 - Math.abs(csy - centre) / (stageH * 0.55));
      var op = clamp01((cprox - 0.12) / 0.6);
      var card = M.cards[c];
      card._op = op; card._sy = csy; card._prox = cprox;
      if (cprox > bestProx) { bestProx = cprox; best = c; }
    }
    for (var d = 0; d < M.cards.length; d++) {
      var cd = M.cards[d];
      if (dock) {
        var show = (d === best && cd._op > 0.02);
        cd.style.opacity = show ? Math.min(1, cd._op * 1.4) : 0;
        cd.style.display = show ? "block" : "none";
      } else {
        if (cd._op <= 0.015) { cd.style.display = "none"; continue; }
        cd.style.display = "block";
        cd.style.opacity = cd._op;
        var h = cd.offsetHeight || 120;
        cd.style.transform = "translate3d(0," + (cd._sy - h / 2).toFixed(1) + "px,0)";
      }
    }

    // progress rail
    if (railFill) railFill.style.height = (p * 100).toFixed(2) + "%";

    // hero + finish overlays
    var heroOp = 1 - smooth01(p / 0.06);
    hero.style.opacity = heroOp;
    hero.style.transform = "translateY(" + (-p * 60).toFixed(1) + "px)";
    hero.style.display = heroOp <= 0.01 ? "none" : "flex";

    var finOp = clamp01((p - 0.9) / 0.09);
    finish.style.opacity = finOp;
    finish.style.display = finOp <= 0.01 ? "none" : "flex";
    finish.setAttribute("aria-hidden", finOp < 0.5 ? "true" : "false");
    var fi = finish.querySelector(".finish-inner");
    if (fi) fi.style.transform = "translateY(" + ((1 - finOp) * 22).toFixed(1) + "px)";
  }

  /* --- ticker loop (own smoothing → smooth without touching scroll speed) - */
  function nowMs() { return (window.performance && performance.now) ? performance.now() : 0; }
  function scrollY() { return window.pageYOffset || document.documentElement.scrollTop || 0; }

  function tick() {
    var tms = nowMs();                                   // ms clock (gsap.ticker's is seconds)
    var cur = scrollY();
    if (!snapping && Math.abs(cur - prevScroll) > 1) lastMove = tms; // user/momentum moving
    maybeSnap(tms);
    prevScroll = scrollY();
    currentP += (targetP - currentP) * 0.14;
    if (Math.abs(targetP - currentP) < 0.00015) currentP = targetP;
    render(currentP, tms);
  }

  /* --- sticky signs: once the user pauses, ease the scroll onto the nearest
     sign so it settles ("sticks") there. Any fresh input cancels it instantly,
     so the scroll is never hard-locked. --------------------------------------- */
  function nearestSnap(p) {
    var best = snapPoints[0] || 0, bd = Math.abs(p - best);
    for (var i = 1; i < snapPoints.length; i++) {
      var d = Math.abs(p - snapPoints[i]);
      if (d < bd) { bd = d; best = snapPoints[i]; }
    }
    return best;
  }
  function maybeSnap(tms) {
    if (!stRef || snapPoints.length < 2) return;
    if (document.documentElement.classList.contains("modal-open")) return; // pop-up open
    if (!snapping) {
      if (tms - lastInput < SNAP_IDLE_MS || tms - lastMove < SNAP_IDLE_MS) return; // still moving
      var near = nearestSnap(targetP);
      if (Math.abs(near - targetP) < 0.0015) return;   // already parked on a sign
      snapping = true; snapTargetP = near;
    }
    var range = stRef.end - stRef.start;
    if (range <= 0) { snapping = false; return; }
    var goal = stRef.start + snapTargetP * range;
    var cur = scrollY();
    var next = cur + (goal - cur) * 0.2;
    if (Math.abs(goal - cur) < 0.6) { next = goal; snapping = false; }
    window.scrollTo(0, next);
  }
  function onUserInput() { lastInput = nowMs(); snapping = false; }

  /* --- setup -------------------------------------------------------------- */
  function computeSplit() {
    if (M.allDone) { S = 1; return; }
    var raw = (M.frontierY - M.carStartY) / (M.destinationY - M.carStartY);
    S = Math.max(0.4, Math.min(0.85, raw));
  }

  // progress value at which the camera centres a given world-Y (lookAtY is monotonic)
  function progressForY(targetY) {
    var lo = 0, hi = 1, mid;
    for (var i = 0; i < 40; i++) { mid = (lo + hi) / 2; if (lookAtY(mid) < targetY) lo = mid; else hi = mid; }
    return clamp01((lo + hi) / 2);
  }
  // scroll "sticky" points: the hero (0), each sign centred, and the finish (1)
  function computeSnaps() {
    var pts = [0];
    M.cps.forEach(function (cp) { pts.push(progressForY(cp.y)); });
    pts.push(1);
    snapPoints = pts.filter(function (v, idx, arr) { return arr.indexOf(v) === idx; }).sort(function (a, b) { return a - b; });
  }

  function init(model) {
    M = model;
    scene = document.getElementById("scene");
    stage = document.getElementById("stage");
    hero = document.getElementById("hero");
    finish = document.getElementById("finish");
    railFill = document.getElementById("rail-fill");
    driveSection = document.getElementById("drive");

    computeSplit();
    computeDims();
    computeSnaps();

    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    stRef = ST.create({
      trigger: driveSection,
      start: "top top",
      end: "bottom bottom",
      pin: stage,
      pinSpacing: true,
      invalidateOnRefresh: true,
      onUpdate: function (self) { targetP = self.progress; },
      onRefresh: function (self) { targetP = self.progress; }
    });

    ST.addEventListener("refreshInit", computeDims);

    // sticky signs: a fresh scroll input cancels any in-progress snap immediately
    ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"].forEach(function (ev) {
      window.addEventListener(ev, onUserInput, { passive: true });
    });

    // interactions: hover brightens a sign; click opens its explainer pop-up
    M.lights.forEach(function (L) {
      L.hit.addEventListener("mouseenter", function () { hoveredIndex = L.index; });
      L.hit.addEventListener("mouseleave", function () { if (hoveredIndex === L.index) hoveredIndex = -1; });
      L.hit.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (window.POPUP) POPUP.open(L.step); });
    });

    gsap.ticker.add(tick);
    running = true;

    // settle layout, then lock in measurements
    window.addEventListener("load", function () { ST.refresh(); });
    setTimeout(function () { ST.refresh(); render(currentP, 0); }, 60);

    render(0, 0);
  }

  // renderAt(p): force the scene to a given progress without waiting on the
  // rAF ticker. Handy for QA/debugging and for jumping the scene on demand.
  function renderAt(p) { currentP = targetP = clamp01(p); render(currentP, (window.performance && performance.now) ? performance.now() : 0); }

  window.DRIVE = { init: init, isRunning: function () { return running; }, renderAt: renderAt };
})();
