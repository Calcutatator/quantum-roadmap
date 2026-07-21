/* ============================================================================
   popup.js — the explainer modal opened by clicking a roadsign (or a "Details"
   button). Themed to match the site, sits over the majority of the screen, and
   does NOT dim the page behind it. Closes on ✕, outside-click, or Esc.
   Exposes window.POPUP.
   ========================================================================== */
(function () {
  "use strict";

  var LABEL = { done: "Completed", current: "You are here", upcoming: "Ahead", progress: "In progress" };

  var el, card, eyebrow, titleEl, body, link, closeBtn, lastFocus = null;

  function q(sel) { return el.querySelector(sel); }

  function init() {
    el = document.getElementById("explainer");
    if (!el) return;
    card = q(".explainer-card");
    eyebrow = q(".explainer-eyebrow");
    titleEl = q(".explainer-title");
    body = q(".explainer-body");
    link = q(".explainer-link");
    closeBtn = q(".explainer-x");

    // close on any [data-close] (the ✕ and the transparent outside-click catcher)
    el.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) close();
    });
    // keyboard: Esc closes; Tab is trapped inside the card while open
    document.addEventListener("keydown", function (e) {
      if (el.hidden) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "Tab") trapTab(e);
    });
  }

  function para(text, cls) {
    var p = document.createElement("p");
    p.className = cls || "explainer-para";
    p.textContent = text;
    return p;
  }

  function open(step) {
    if (!el || !step) return;
    lastFocus = document.activeElement;

    eyebrow.textContent = LABEL[step.status] || "Roadmap";
    eyebrow.setAttribute("data-status", step.status || "");
    titleEl.textContent = step.title || "";

    body.innerHTML = "";
    if (step.detail) body.appendChild(para(step.detail));
    if (step.hurdle) {
      body.appendChild(para("The hurdle", "explainer-label"));
      body.appendChild(para(step.hurdle));
    }

    if (step.link && step.link.url && step.link.label) {
      link.textContent = step.link.label + " →";
      link.href = step.link.url;
      link.hidden = false;
    } else {
      link.hidden = true;
    }

    el.hidden = false;
    document.documentElement.classList.add("modal-open"); // stops the scene scrolling behind
    if (card) card.scrollTop = 0;
    requestAnimationFrame(function () { if (closeBtn) closeBtn.focus(); });
  }

  function close() {
    if (!el || el.hidden) return;
    el.hidden = true;
    document.documentElement.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function trapTab(e) {
    var f = card.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  window.POPUP = { init: init, open: open, close: close };
})();
