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
  var dock = false;      // narrow-screen: dock cards to the bottom
  var running = false;
  var hoveredIndex = -1; // sign currently hovered by the mouse (brightens)
  var REACH_BAND = 130;  // world-units over which a sign changes colour as the car arrives
  var phases = [];       // pacing timeline: eased "travel" legs + flat "dwell" (STOP) at each light
  var snapCenters = [];  // progress at the centre of each light's dwell (settle targets)
  var TRAVEL_W = 1.1;    // relative scroll spent driving between lights
  var DWELL_W = 0.9;     // relative scroll the car is STOPPED at each light

  // Settle: after scrolling stops, ease the scroll onto the nearest light so it
  // always comes to rest ON a light (even after a fast flick). Idle-gated.
  var stRef = null, scrollHint = null;
  var lastInput = -1e9;  // ms of the last real user scroll input (wheel/touch/key)
  var lastMove = -1e9;   // ms the scroll position last changed (covers touch momentum)
  var prevScroll = 0;    // last observed scroll position
  var snapping = false, snapTargetP = 0;
  var SNAP_IDLE_MS = 140;  // quiet time after input before it settles onto a light
  var HINT_IDLE_MS = 1000; // time stopped at a light before the "scroll to drive" hint

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
  // The camera centres on a staircase of stops (start → every light → finish):
  // it EASES along each "travel" leg, then HOLDS on a flat "dwell" so the car
  // visibly STOPS at every light — the same hold the "you are here" frontier
  // uses. Pure function of p, so it stops on the first pass and is testable.
  function lookAtY(p) {
    if (!phases.length) return M.carStartY;
    if (p <= 0) return phases[0].from;
    for (var i = 0; i < phases.length; i++) {
      var ph = phases[i];
      if (p <= ph.p1 || i === phases.length - 1) {
        if (ph.type === "dwell") return ph.at;
        return lerp(ph.from, ph.to, smooth01((p - ph.p0) / (ph.p1 - ph.p0)));
      }
    }
    return M.destinationY;
  }
  // the car follows the camera up to the frontier, then parks there
  function carY(p) { return Math.min(lookAtY(p), M.frontierY); }

  function worldToScreenY(worldY, camTy) { return (worldY + camTy) * k; }

  /* --- dimensions --------------------------------------------------------- */
  function computeDims() {
    var r = stage.getBoundingClientRect();
    var w = r.width || window.innerWidth || 0;
    var h = r.height || window.innerHeight || 0;
    if (w <= 0 || h <= 0) return;           // not laid out yet — never write NaN; a later refresh catches it
    stageW = w; stageH = h;
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

  /* --- ticker loop: smooth currentP → targetP (ms clock — gsap.ticker's is
     seconds, which would leave the sign "breathing" effectively frozen) ------ */
  function nowMs() { return (window.performance && performance.now) ? performance.now() : 0; }
  function scrollY() { return window.pageYOffset || document.documentElement.scrollTop || 0; }

  function tick() {
    var tms = nowMs();
    var cur = scrollY();
    if (!snapping && Math.abs(cur - prevScroll) > 1) lastMove = tms; // user/momentum still scrolling
    maybeSnap(tms);
    prevScroll = scrollY();
    currentP += (targetP - currentP) * 0.14;
    if (Math.abs(targetP - currentP) < 0.00015) currentP = targetP;
    render(currentP, tms);
    updateHint(tms);
  }

  /* --- settle onto the nearest light after scrolling stops (point 5) ------- */
  function nearestSnap(p) {
    var best = snapCenters.length ? snapCenters[0] : 0, bd = Math.abs(p - best);
    for (var i = 1; i < snapCenters.length; i++) {
      var d = Math.abs(p - snapCenters[i]);
      if (d < bd) { bd = d; best = snapCenters[i]; }
    }
    return best;
  }
  function maybeSnap(tms) {
    if (!stRef || snapCenters.length < 2) return;
    if (document.documentElement.classList.contains("modal-open")) return; // pop-up open
    if (tms - lastInput < SNAP_IDLE_MS || tms - lastMove < SNAP_IDLE_MS) { snapping = false; return; } // still scrolling / momentum
    if (!snapping) {
      var near = nearestSnap(targetP);
      if (Math.abs(near - targetP) < 0.0015) return;                        // already on a light
      snapping = true; snapTargetP = near;
    }
    var range = stRef.end - stRef.start;
    if (range <= 0) { snapping = false; return; }
    var goal = stRef.start + snapTargetP * range;
    var cur = scrollY();
    var next = cur + (goal - cur) * 0.18;
    if (Math.abs(goal - cur) < 0.6) { next = goal; snapping = false; }
    window.scrollTo(0, next);
  }
  function onUserInput() { lastInput = nowMs(); snapping = false; hideHint(); }

  /* --- idle "Scroll to drive" hint when stopped at a light (point 3) ------- */
  function atLight(p) {
    for (var i = 0; i < phases.length; i++) {
      if (p >= phases[i].p0 && p <= phases[i].p1) return phases[i].type === "dwell" && phases[i].isLight;
    }
    return false;
  }
  function hideHint() { if (scrollHint) scrollHint.classList.remove("is-visible"); }
  function updateHint(tms) {
    if (!scrollHint) return;
    var show = (tms - lastInput > HINT_IDLE_MS) && atLight(currentP) &&
               !document.documentElement.classList.contains("modal-open");
    scrollHint.classList.toggle("is-visible", show);
  }

  /* --- setup -------------------------------------------------------------- */
  // Build the pacing timeline: travel to each stop, then a flat dwell (STOP)
  // at it. stops = start → every light → finish. Longer dwell = longer hold.
  function computePacing() {
    var stops = [M.carStartY];
    M.cps.forEach(function (cp) { stops.push(cp.y); });
    stops.push(M.destinationY);
    var raw = [];
    for (var j = 1; j < stops.length; j++) {
      raw.push({ type: "travel", from: stops[j - 1], to: stops[j] });
      raw.push({ type: "dwell", at: stops[j] });
    }
    var total = 0;
    raw.forEach(function (r) { total += (r.type === "travel" ? TRAVEL_W : DWELL_W); });
    if (total === 0) total = 1;
    var acc = 0;
    phases = raw.map(function (r, idx) {
      var w = (r.type === "travel" ? TRAVEL_W : DWELL_W);
      var p0 = acc / total; acc += w; var p1 = acc / total;
      // a dwell is a "light" unless it's the final stop (the destination/finish)
      var isLight = (r.type === "dwell" && idx !== raw.length - 1);
      return { type: r.type, from: r.from, to: r.to, at: r.at, p0: p0, p1: p1, isLight: isLight };
    });
    // settle targets: the centre of every dwell, plus the hero/start (0)
    snapCenters = [0].concat(phases.filter(function (ph) { return ph.type === "dwell"; })
                                   .map(function (ph) { return (ph.p0 + ph.p1) / 2; }));
  }

  function init(model) {
    M = model;
    scene = document.getElementById("scene");
    stage = document.getElementById("stage");
    hero = document.getElementById("hero");
    finish = document.getElementById("finish");
    railFill = document.getElementById("rail-fill");
    driveSection = document.getElementById("drive");
    scrollHint = document.getElementById("scroll-hint");

    computePacing();
    computeDims();

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

    // a fresh scroll input cancels the settle and hides the idle hint
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
