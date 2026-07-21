/* ============================================================================
   main.js — bootstrap. Always renders the accessible baseline; upgrades to the
   animated birdseye drive only when it's both possible and welcome.
   ========================================================================== */
(function () {
  "use strict";

  function boot() {
    var steps = window.ROADMAP;

    if (!window.SCENE || !SCENE.validate(steps)) {
      // nothing we can do; the <noscript>/empty state stands
      return;
    }

    // 1) Accessible baseline — always present.
    SCENE.buildStatic(steps);

    // Explainer pop-up works in both the animated and static views.
    if (window.POPUP) POPUP.init();

    // 2) Decide whether to enhance.
    var prefersReduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var haveGsap = !!(window.gsap && window.ScrollTrigger);

    if (prefersReduced) {
      console.info("[roadmap] Reduced motion is on — showing the static timeline.");
      return;
    }
    if (!haveGsap) {
      console.warn("[roadmap] GSAP/ScrollTrigger unavailable (offline?) — showing the static timeline.");
      return;
    }

    // 3) Enhance. If anything throws, roll back to the baseline.
    try {
      var root = document.documentElement;
      root.classList.add("is-enhanced");

      // give the pin enough scroll room: one screenful per step, plus hero + finish
      var scrollVh = Math.max(steps.length + 2.5, 5) * 100;
      document.getElementById("drive").style.height = scrollVh + "vh";

      var model = SCENE.build(steps);
      window.DRIVE.init(model);
    } catch (err) {
      console.error("[roadmap] Enhancement failed — reverting to the static timeline.", err);
      document.documentElement.classList.remove("is-enhanced");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
