/* ============================================================================
   scene.js — turns roadmap.config.js into (a) an accessible timeline and
   (b) the birdseye SVG world + HTML copy panels. No animation here; drive.js
   moves what this builds. Exposes window.SCENE.
   ========================================================================== */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- world geometry (SVG units; viewBox is 1000 wide) ------------------- */
  var W          = 1000;   // viewBox width
  var ROAD_W     = 150;    // asphalt width
  var CURVE_AMP  = 118;    // horizontal sway of the road
  var CURVE_FREQ = (2 * Math.PI) / 1650;
  var CURVE_PH   = 320;    // phase so the first stretch leans nicely
  var CAR_START  = 210;    // where the car idles at the hero
  var HERO_PAD   = 540;    // distance from top to the first light
  var SEG        = 660;    // distance between lights
  var FINISH_PAD = 760;    // distance from last light to the destination

  /* --- road shape helpers (car follows the SAME function → perfect fit) --- */
  function roadX(y) { return W / 2 + CURVE_AMP * Math.sin((y + CURVE_PH) * CURVE_FREQ); }
  function roadDx(y) { return CURVE_AMP * CURVE_FREQ * Math.cos((y + CURVE_PH) * CURVE_FREQ); } // dx/dy
  function roadAngle(y) { return -Math.atan(roadDx(y)) * 180 / Math.PI; } // deg; car nose points +y

  /* --- tiny helpers ------------------------------------------------------- */
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function html(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  // deterministic PRNG so scattered scenery doesn't jump on resize/rebuild
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var STATUS_LABEL = {
    done: "Completed",
    current: "You are here",
    upcoming: "Ahead",
    progress: "In progress"
  };

  /* --- validation (safety rails from the scope §4.4) ---------------------- */
  function validate(steps) {
    if (!Array.isArray(steps) || !steps.length) {
      console.error("[roadmap] window.ROADMAP is missing or empty.");
      return false;
    }
    var currents = steps.filter(function (s) { return s.status === "current"; });
    if (currents.length === 0) {
      console.warn("[roadmap] No step has status:\"current\" — the car will drive all the way to the finish.");
    } else if (currents.length > 1) {
      console.warn("[roadmap] " + currents.length + " steps are \"current\"; there should be exactly one. Using the first.");
    }
    // monotonic check: done should not appear after current/upcoming
    var seenNonDone = false;
    steps.forEach(function (s, i) {
      if (s.status !== "done") seenNonDone = true;
      else if (seenNonDone) console.warn('[roadmap] Step ' + (i + 1) + ' ("' + s.title + '") is "done" but sits below a later step — roadmap should read done → current → upcoming.');
    });
    return true;
  }

  /* --- accessible baseline list (also the reduced-motion view) ------------ */
  function buildStatic(steps) {
    var list = document.getElementById("rs-list");
    if (!list) return;
    list.innerHTML = "";
    steps.forEach(function (s) {
      var li = html("li", "rs-item");
      li.setAttribute("data-status", s.status || "upcoming");
      li.appendChild(svgless_dot());
      li.appendChild(html("span", "rs-badge", STATUS_LABEL[s.status] || "Ahead"));
      li.appendChild(html("h3", "rs-item-title", s.title || ""));
      if (s.body) li.appendChild(html("p", "rs-item-body", s.body));
      if (s.detail) {
        var more = html("button", "rs-more", "Details →");
        more.type = "button";
        more.addEventListener("click", function () { if (window.POPUP) POPUP.open(s); });
        li.appendChild(more);
      }
      list.appendChild(li);
    });
    function svgless_dot() { return html("span", "rs-dot"); }
  }

  /* --- build the birdseye SVG world + HTML cards -------------------------- */
  function build(steps) {
    var n = steps.length;

    // resolve checkpoint world-Y positions
    var cps = steps.map(function (s, i) {
      var y = HERO_PAD + i * SEG;
      return { index: i, step: s, status: s.status || "upcoming", y: y, x: roadX(y) };
    });

    var lastY = cps.length ? cps[cps.length - 1].y : HERO_PAD;
    var destinationY = lastY + FINISH_PAD;
    var worldH = destinationY + 240;

    // frontier = the single "current" step; else the finish
    var currentIndex = steps.findIndex(function (s) { return s.status === "current"; });
    var allDone = currentIndex === -1;
    var frontierY = allDone ? destinationY : cps[currentIndex].y;

    var scene = document.getElementById("scene");
    scene.innerHTML = "";
    var defs = buildDefs();
    scene.appendChild(defs);

    var world = svg("g", { id: "world" });
    scene.appendChild(world);

    // layers (back → front)
    world.appendChild(buildGround(worldH));
    world.appendChild(buildScenery(worldH));
    world.appendChild(buildRoad(worldH));
    var destEl = buildDestination(destinationY);
    world.appendChild(destEl);

    var lights = [];
    cps.forEach(function (cp) {
      var g = buildLight(cp);
      world.appendChild(g.group);
      lights.push(g);
    });

    var car = buildCar();
    world.appendChild(car);

    // HTML copy panels
    var cardsWrap = document.getElementById("cards");
    cardsWrap.innerHTML = "";
    var cards = cps.map(function (cp) {
      var card = html("article", "card card-" + (cp.index % 2 === 0 ? "left" : "right"));
      card.setAttribute("data-status", cp.status);
      card.appendChild(html("span", "card-badge", STATUS_LABEL[cp.status] || "Ahead"));
      card.appendChild(html("h3", "card-title", cp.step.title || ""));
      if (cp.step.body) card.appendChild(html("p", "card-body", cp.step.body));
      var more = html("button", "card-more", "Details →");
      more.type = "button";
      more.addEventListener("click", function (e) { e.stopPropagation(); if (window.POPUP) POPUP.open(cp.step); });
      card.appendChild(more);
      cardsWrap.appendChild(card);
      return card;
    });

    return {
      W: W, worldH: worldH,
      cps: cps, lights: lights, cards: cards,
      carEl: car, worldEl: world,
      carStartY: CAR_START, frontierY: frontierY, destinationY: destinationY,
      currentIndex: currentIndex, allDone: allDone,
      roadX: roadX, roadAngle: roadAngle
    };
  }

  /* --- SVG pieces --------------------------------------------------------- */
  function buildDefs() {
    var defs = svg("defs");
    defs.innerHTML =
      '<linearGradient id="nebula" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#EC796B"/><stop offset="1" stop-color="#D672EF"/>' +
      '</linearGradient>' +
      '<linearGradient id="roadGrad" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#1a1a52"/><stop offset="0.5" stop-color="#26265f"/><stop offset="1" stop-color="#1a1a52"/>' +
      '</linearGradient>' +
      '<radialGradient id="destGlow" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="#D672EF" stop-opacity="0.55"/>' +
        '<stop offset="0.6" stop-color="#4343D1" stop-opacity="0.18"/>' +
        '<stop offset="1" stop-color="#0C0C4F" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<filter id="soft" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="7"/>' +
      '</filter>' +
      '<filter id="lampGlow" x="-150%" y="-150%" width="400%" height="400%">' +
        '<feGaussianBlur stdDeviation="6"/>' +
      '</filter>';
    return defs;
  }

  function buildGround(worldH) {
    var g = svg("g");
    // base fields as broad soft bands (kept subordinate to the navy ground)
    g.appendChild(svg("rect", { x: -60, y: -200, width: W + 120, height: worldH + 400, fill: "#0b0b46" }));
    // faint distant texture dots
    var rnd = mulberry32(1337);
    for (var i = 0; i < Math.round(worldH / 22); i++) {
      var x = rnd() * (W + 120) - 60;
      var y = rnd() * (worldH + 300) - 150;
      var r = 0.6 + rnd() * 1.3;
      g.appendChild(svg("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), fill: "#Bfbfe8", opacity: (0.05 + rnd() * 0.09).toFixed(2) }));
    }
    return g;
  }

  function buildScenery(worldH) {
    var g = svg("g");
    var rnd = mulberry32(90210);
    // meandering river (a soft blue ribbon well off to one side)
    var rx = W * 0.14, riverPts = "M " + rx + " -160";
    for (var y = -100; y < worldH + 200; y += 90) {
      rx = W * 0.14 + Math.sin(y * 0.0016 + 2) * 70;
      riverPts += " L " + rx.toFixed(1) + " " + y;
    }
    g.appendChild(svg("path", { d: riverPts, fill: "none", stroke: "#2a4d7a", "stroke-width": 34, "stroke-linecap": "round", opacity: 0.45 }));
    g.appendChild(svg("path", { d: riverPts, fill: "none", stroke: "#3f8cff", "stroke-width": 8, "stroke-linecap": "round", opacity: 0.18 }));

    // green hill/tree clusters, scattered but clear of the central road corridor
    var greens = ["#2f6f5e", "#357a5f", "#3d8a6a", "#2b6357"];
    for (var yy = -60; yy < worldH + 120; yy += 78) {
      for (var side = 0; side < 2; side++) {
        if (rnd() < 0.32) continue;
        var edge = side === 0 ? rnd() * (W * 0.30) : W - rnd() * (W * 0.30);
        var jitterY = yy + (rnd() - 0.5) * 60;
        var cluster = svg("g");
        var blobs = 2 + Math.floor(rnd() * 3);
        for (var b = 0; b < blobs; b++) {
          var bx = edge + (rnd() - 0.5) * 70;
          var by = jitterY + (rnd() - 0.5) * 46;
          var rr = 14 + rnd() * 30;
          cluster.appendChild(svg("ellipse", { cx: bx.toFixed(1), cy: by.toFixed(1), rx: rr.toFixed(1), ry: (rr * (0.7 + rnd() * 0.3)).toFixed(1), fill: greens[Math.floor(rnd() * greens.length)], opacity: (0.5 + rnd() * 0.35).toFixed(2) }));
        }
        g.appendChild(cluster);
      }
    }
    return g;
  }

  function buildRoad(worldH) {
    var g = svg("g");
    var d = "M " + roadX(-160).toFixed(1) + " -160";
    for (var y = -120; y <= worldH + 200; y += 22) {
      d += " L " + roadX(y).toFixed(1) + " " + y;
    }
    // shoulder / glow
    g.appendChild(svg("path", { d: d, fill: "none", stroke: "#3a3a86", "stroke-width": ROAD_W + 14, "stroke-linecap": "round", opacity: 0.35 }));
    // asphalt
    g.appendChild(svg("path", { d: d, fill: "none", stroke: "url(#roadGrad)", "stroke-width": ROAD_W, "stroke-linecap": "round" }));
    // dashed nebula centreline
    g.appendChild(svg("path", { d: d, fill: "none", stroke: "url(#nebula)", "stroke-width": 4, "stroke-linecap": "round", "stroke-dasharray": "26 34", opacity: 0.55 }));
    return g;
  }

  function buildLight(cp) {
    var x = cp.x, y = cp.y;
    var group = svg("g", { class: "light", "data-index": cp.index, "data-status": cp.status });

    // gantry bar across the road
    var barW = ROAD_W + 70;
    group.appendChild(svg("rect", { x: (x - barW / 2).toFixed(1), y: (y - 5).toFixed(1), width: barW, height: 9, rx: 4, fill: "#2b2b63", opacity: 0.9 }));
    group.appendChild(svg("rect", { x: (x - barW / 2).toFixed(1), y: (y - 5).toFixed(1), width: barW, height: 3, rx: 1.5, fill: "#4a4a9a", opacity: 0.6 }));

    var hw = 62, hh = 26;

    // hover ring (framing highlight; shown on :hover via CSS)
    group.appendChild(svg("rect", { class: "light-ring", x: (x - hw / 2 - 7).toFixed(1), y: (y - hh / 2 - 7).toFixed(1), width: hw + 14, height: hh + 14, rx: 14, fill: "none", stroke: "#FBFBFB", "stroke-width": 2, opacity: 0 }));

    // signal housing (top-down): three lamps L=red M=amber R=green
    var hx = x - hw / 2, hy = y - hh / 2;
    group.appendChild(svg("rect", { x: hx.toFixed(1), y: hy.toFixed(1), width: hw, height: hh, rx: 8, fill: "#141436", stroke: "#3a3a80", "stroke-width": 1.5 }));

    var lampR = 7.2;
    var positions = { red: x - 18, amber: x, green: x + 18 };
    var colors = { red: "#EC796B", amber: "#F4B15E", green: "#90EAC4" };
    // dim base glass for all three positions
    ["red", "amber", "green"].forEach(function (key) {
      group.appendChild(svg("circle", { cx: positions[key], cy: y, r: lampR, fill: colors[key], opacity: 0.16 }));
    });

    // controllable lamps (halo + core), driven each frame by drive.js:
    //   amber = "ahead / not reached" (every sign has one)
    //   green = a "done" sign the car has passed
    //   red   = the "current" frontier the car stops at
    var lamps = {};
    function makeLamp(key) {
      var halo = svg("circle", { cx: positions[key], cy: y, r: lampR * 3.1, fill: colors[key], filter: "url(#lampGlow)", opacity: 0 });
      var core = svg("circle", { cx: positions[key], cy: y, r: lampR, fill: colors[key], opacity: 0 });
      group.appendChild(halo); group.appendChild(core);
      return { halo: halo, core: core };
    }
    lamps.amber = makeLamp("amber");
    if (cp.status === "done") lamps.green = makeLamp("green");
    if (cp.status === "current") lamps.red = makeLamp("red");

    // "You are here" tag for the frontier (opacity driven by how far the car has arrived)
    var tag = null;
    if (cp.status === "current") {
      var tagW = 118, tagY = y - hh / 2 - 34;
      tag = svg("g", { class: "here-tag", opacity: 0 });
      tag.appendChild(svg("rect", { x: (x - tagW / 2).toFixed(1), y: tagY, width: tagW, height: 24, rx: 12, fill: "#EC796B" }));
      var t = svg("text", { x: x, y: tagY + 16, "text-anchor": "middle", "font-family": "Inter, sans-serif", "font-size": 11, "font-weight": 800, "letter-spacing": "1.5", fill: "#1a0f2e" });
      t.textContent = "YOU ARE HERE";
      tag.appendChild(t);
      tag.appendChild(svg("path", { d: "M " + (x - 5) + " " + (tagY + 24) + " L " + (x + 5) + " " + (tagY + 24) + " L " + x + " " + (tagY + 31) + " Z", fill: "#EC796B" }));
      group.appendChild(tag);
    }

    // transparent hit target on top — makes hover/click reliable across the sign
    var hit = svg("rect", { class: "light-hit", x: (x - 80).toFixed(1), y: (y - 46).toFixed(1), width: 160, height: 88, fill: "transparent", "pointer-events": "all" });
    group.appendChild(hit);

    return { group: group, lamps: lamps, tag: tag, hit: hit, status: cp.status, y: y, x: x, index: cp.index, step: cp.step };
  }

  function buildDestination(y) {
    var g = svg("g", { id: "destination" });
    var x = roadX(y);
    // glow field
    g.appendChild(svg("circle", { cx: x, cy: y, r: 260, fill: "url(#destGlow)" }));
    // finish pad ring
    g.appendChild(svg("circle", { cx: x, cy: y, r: 96, fill: "none", stroke: "url(#nebula)", "stroke-width": 6, opacity: 0.9 }));
    g.appendChild(svg("circle", { cx: x, cy: y, r: 74, fill: "none", stroke: "#A1A1D6", "stroke-width": 1.5, opacity: 0.4 }));
    // central Starknet-spark nod (diamond)
    var s = 34;
    g.appendChild(svg("path", { d: "M " + x + " " + (y - s) + " L " + (x + s * 0.7) + " " + y + " L " + x + " " + (y + s) + " L " + (x - s * 0.7) + " " + y + " Z", fill: "url(#nebula)", opacity: 0.95 }));
    // radiating ticks
    for (var a = 0; a < 12; a++) {
      var ang = (a / 12) * Math.PI * 2;
      var r1 = 104, r2 = 118;
      g.appendChild(svg("line", { x1: (x + Math.cos(ang) * r1).toFixed(1), y1: (y + Math.sin(ang) * r1).toFixed(1), x2: (x + Math.cos(ang) * r2).toFixed(1), y2: (y + Math.sin(ang) * r2).toFixed(1), stroke: "#D672EF", "stroke-width": 3, opacity: 0.5, "stroke-linecap": "round" }));
    }
    return g;
  }

  function buildCar() {
    // top-down car, nose pointing +y (down = forward). Centred at (0,0).
    var g = svg("g", { id: "car" });
    // headlight beams (soft cones ahead)
    g.appendChild(svg("path", { d: "M -10 26 L -44 120 L -2 92 Z", fill: "#FBF2B1", opacity: 0.10, filter: "url(#soft)" }));
    g.appendChild(svg("path", { d: "M 10 26 L 44 120 L 2 92 Z", fill: "#FBF2B1", opacity: 0.10, filter: "url(#soft)" }));
    // shadow
    g.appendChild(svg("ellipse", { cx: 3, cy: 4, rx: 22, ry: 38, fill: "#000", opacity: 0.28, filter: "url(#soft)" }));
    // body
    g.appendChild(svg("rect", { x: -17, y: -33, width: 34, height: 66, rx: 13, fill: "#e9e9f6" }));
    g.appendChild(svg("rect", { x: -17, y: -33, width: 34, height: 66, rx: 13, fill: "none", stroke: "#b9b9df", "stroke-width": 1 }));
    // nebula accent stripe
    g.appendChild(svg("rect", { x: -17, y: -6, width: 34, height: 12, fill: "url(#nebula)", opacity: 0.85 }));
    // windshield (front) + rear window
    g.appendChild(svg("path", { d: "M -12 8 Q 0 2 12 8 L 10 22 Q 0 18 -10 22 Z", fill: "#1a1a52", opacity: 0.9 }));
    g.appendChild(svg("path", { d: "M -11 -24 Q 0 -20 11 -24 L 9 -12 Q 0 -15 -9 -12 Z", fill: "#26265f", opacity: 0.85 }));
    // roof
    g.appendChild(svg("rect", { x: -11, y: -11, width: 22, height: 20, rx: 5, fill: "#f4f4fb" }));
    // headlights (front, +y)
    g.appendChild(svg("circle", { cx: -10, cy: 29, r: 3, fill: "#FBF2B1" }));
    g.appendChild(svg("circle", { cx: 10, cy: 29, r: 3, fill: "#FBF2B1" }));
    // taillights (rear, -y)
    g.appendChild(svg("circle", { cx: -11, cy: -30, r: 2.4, fill: "#EC796B" }));
    g.appendChild(svg("circle", { cx: 11, cy: -30, r: 2.4, fill: "#EC796B" }));
    return g;
  }

  window.SCENE = { validate: validate, buildStatic: buildStatic, build: build };
})();
