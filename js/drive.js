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

  /* --- easing --- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth01(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  /* --- camera model ------------------------------------------------------- */
  // path fraction the CAMERA centres on
  function lookAtY(p) {
    if (p <= S) return lerp(M.carStartY, M.frontierY, easeOutCubic(p / S));
    return lerp(M.frontierY, M.destinationY, easeInOut((p - S) / (1 - S)));
  }
  // where the CAR sits (parks at the frontier once reached)
  function carY(p) {
    if (p <= S) return lerp(M.carStartY, M.frontierY, easeOutCubic(p / S));
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
    var pulse = 0.72 + 0.28 * Math.sin((time || 0) * 0.004);

    // lights
    for (var i = 0; i < M.lights.length; i++) {
      var L = M.lights[i];
      var sy = worldToScreenY(L.y, camTy);
      var prox = clamp01(1 - Math.abs(sy - centre) / (stageH * 0.62));
      if (L.status === "done") {
        var lit = clamp01((stageH * 0.60 - sy) / (stageH * 0.30));  // flicks green as we reach it, then latches
        if (L.halo) L.halo.setAttribute("opacity", (lit).toFixed(3));
        if (L.core) L.core.setAttribute("opacity", (0.22 + lit * 0.78).toFixed(3));
      } else if (L.status === "current") {
        if (L.halo) L.halo.setAttribute("opacity", ((0.62 + 0.38 * prox) * pulse).toFixed(3));
        if (L.core) L.core.setAttribute("opacity", (0.9 + 0.1 * prox).toFixed(3));
      } else if (L.status === "progress") {
        if (L.halo) L.halo.setAttribute("opacity", ((0.35 + 0.4 * prox) * pulse).toFixed(3));
        if (L.core) L.core.setAttribute("opacity", (0.2 + 0.6 * prox).toFixed(3));
      } else { // upcoming — stays unlit; a faint hint when centred
        if (L.halo) L.halo.setAttribute("opacity", (prox * 0.22).toFixed(3));
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
  function tick(time) {
    currentP += (targetP - currentP) * 0.14;
    if (Math.abs(targetP - currentP) < 0.00015) currentP = targetP;
    render(currentP, time);
  }

  /* --- setup -------------------------------------------------------------- */
  function computeSplit() {
    if (M.allDone) { S = 1; return; }
    var raw = (M.frontierY - M.carStartY) / (M.destinationY - M.carStartY);
    S = Math.max(0.4, Math.min(0.85, raw));
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

    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    ST.create({
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
