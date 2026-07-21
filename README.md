# How close is Starknet to being post-quantum secure?

A single, vertically-scrolling page shown from a **birdseye (top-down) view**. A
car drives down a road through green hills, passing a sequence of **traffic
lights** — each one a step on Starknet's quantum roadmap. Scrolling drives the
car forward and **sticks on each sign** as you reach it. Signs the car hasn't
reached yet glow **amber**; a completed sign flicks **green** as the car passes;
the **current** frontier glows **red** and the car **parks** there ("You are
here"). The road keeps going below to the destination — **Post-Quantum Secure**.

Every sign is interactive: **hover** to brighten it, and **click** it (or its
"Details" button) to open a themed **pop-up explainer** with more detail and a
link. The sign you're stopped at gently breathes.

Built to the approved design & technical scope. Brand: **Starknet** (Infinite
Blue ground, Nebula gradient, Inter).

---

## Quick start

It's a plain static site — no build step, no backend.

**View it:**

- **Local server (recommended):**
  ```bash
  cd "quantum drive"
  python3 -m http.server 4599
  # open http://localhost:4599
  ```
- **Or just open `index.html`** directly in a browser (`file://`). It's built to
  work without a server (scripts are plain, non-module, and content comes from a
  global — no fetch/CORS).

**Deploy it:** drop the folder on any static host — Vercel, Netlify, GitHub
Pages. No server, no database.

---

## ✍️ Editing the content — the only file you touch

Everything on the page is generated from **`roadmap.config.js`**. Open it and
edit the text between the quotes. The scene — how many lights, their spacing,
where the car stops, how full the progress rail is — is all derived from this
array, so there's nothing else to keep in sync.

Each step looks like this:

```js
{
  id: "pq-accounts",
  title:  "Post-quantum accounts",                  // ← heading at the light AND pop-up
  body:   "One line shown on the drive-by card.",    // ← short card text
  status: "current",                                 // done | current | upcoming
  detail: "What it is — 1–3 sentences (pop-up).",    // ← pop-up explainer
  hurdle: "The challenge — 1–2 sentences (pop-up).", // ← optional; shown under "The hurdle"
  link:   { label: "Read more", url: "https://…" }   // ← pop-up link; blank = hidden
}
```

### The two things you'll want to do

**1. Write / change the copy** → edit that step's `title`, `body`, and the pop-up
`detail` / `hurdle` / `link`.

**2. Flip a light and move the car** → change that step's `status`. The lamp
colour is then driven by the car's position:

| `status`    | Before the car reaches it | After | Car does…                          |
|-------------|---------------------------|-------|------------------------------------|
| `"done"`    | **Amber** (ahead)         | flicks **Green** as it passes | drives through it |
| `"current"` | **Amber** (ahead)         | turns **Red** on arrival | **stops here** — "You are here" |
| `"upcoming"`| **Amber** (ahead)         | stays **Amber** (never reached) | road visible, untravelled |

So **every sign the car hasn't reached yet glows amber**; green means "passed",
red means "you are here". The car's stopping point is **not hard-coded** — the
engine parks it at whichever step is `"current"`. Moving the frontier is a
one-word edit.

- **Add a step:** copy one `{ … }` block and fill it in.
- **Remove a step:** delete its block.

The engine re-spaces the road, lights and copy panels automatically.

### Safety rails (warnings show in the browser console)

- There should be exactly **one** `"current"` step. Zero or many → a warning.
- Steps should read top-to-bottom `done → current → upcoming`. A misorder warns.
- An empty `link` is hidden automatically.
- If **no** step is `"current"` (all done), the car drives all the way to the
  "Post-Quantum Secure" finish.

> ⚠️ The copy shipped in `roadmap.config.js` is **placeholder scaffolding** so the
> page has something to show. Replace it with approved roadmap content — the
> real wording was deliberately deferred in the scope.

---

## How it works (short version)

| File | Role |
|------|------|
| `roadmap.config.js` | **Source of truth.** The content + status array. |
| `index.html` | Semantic baseline (an ordered list) + the enhanced scene containers. |
| `css/styles.css` | Starknet brand system, the scene, and the static timeline. |
| `js/scene.js` | Validates the config, builds the accessible list, and constructs the SVG world (road, hills, gantry lights, car, destination) + HTML copy panels. |
| `js/drive.js` | The scroll engine + interactions: pins/snaps, drives sign colour & breathing from car position, handles hover. Everything is a pure function of one progress value `p ∈ [0,1]`. |
| `js/popup.js` | The explainer modal — open/close, content from the config, focus + Esc handling. |
| `js/main.js` | Bootstrap: always renders the baseline; upgrades to the animated drive only when possible and welcome. |

- **Motion:** GSAP + ScrollTrigger (loaded via CDN — free for commercial use
  since April 2025). ScrollTrigger pins the stage and supplies scroll progress;
  a small ticker smooths it for feel **without** hijacking scroll speed.
- **Sticky signs:** ScrollTrigger `snap` settles the scroll onto the nearest
  sign when you pause (evenly spaced, one per sign plus the hero and finish). It
  eases you onto a sign — it never hard-locks the scroll.
- **The car follows the road** because both are drawn from the same curve
  function — no MotionPath plugin needed, one fewer dependency to break.
- **Two-zone camera:** up to the frontier the camera follows the car (it stays
  centred while the world scrolls past); past the frontier the camera unpins and
  the parked car drifts up and out of the top while the amber road-ahead scrolls in.
- **Sign state** is a pure function of the car's position: amber (ahead) →
  green (passed) / red (frontier). Hover brightens a sign; the centred sign
  breathes; clicking a sign opens its pop-up (`js/popup.js`).

### Debug / preview hook

`window.DRIVE.renderAt(p)` jumps the scene to any progress `p` between 0 and 1
(e.g. `DRIVE.renderAt(0.5)` in the console). Handy for previewing a specific
moment or checking a content change without scrolling.

---

## Accessibility, responsive, performance

- **Reduced motion is honoured (hard requirement).** With
  `prefers-reduced-motion: reduce`, the page does **not** animate — it shows the
  same steps as a clean vertical timeline with green / red / amber status, and
  each item's "Details" button opens the same pop-up. The same view is the
  fallback if GSAP can't load (e.g. offline).
- **Progressive enhancement.** The steps render as a semantic ordered list
  first; JS enhances that into the animated scene. *(Note: because content lives
  in a JS file, the page needs JavaScript at all to show anything — an inherent
  trade-off of the "single editable config, no build" decision. A `<noscript>`
  message covers the scripts-off case.)*
- **Sticky, not locked.** Scrolling settles onto the nearest sign when you
  pause (snap), but is never hard-locked; keyboard, space-bar and page-down all
  work normally.
- **Mobile.** Vertical scroll is naturally mobile-friendly; on narrow screens the
  copy panels dock to the bottom of the viewport.
- **Performance.** Animation touches transform/opacity only; the render is a
  single pass driven by one value.

---

## Design decisions (the scope's open questions, resolved)

These followed the scope's own recommendations; all are easy to revisit.

1. **Car past the frontier** — parks and drifts up out of the top as the unlit
   road scrolls in (most honest).
2. **Road shape** — gentle S-curves; the car banks into the turns.
3. **Progress meter** — included: a "distance to post-quantum secure" rail.
4. **Amber state** — amber now means "the car hasn't reached this sign yet";
   signs turn green (passed) or red (frontier) from the car's position.
5. **Destination** — a payoff moment: a glowing Nebula "Post-Quantum Secure"
   badge over a radiating finish marker.
6. **Art assets** — generated as inline SVG (no external image dependency).

---

## Notes / possible next steps

- **Real copy** — replace the placeholders in `roadmap.config.js`.
- **Brand logo** — the official Starknet logo asset isn't bundled; add it to the
  hero/finish if desired (place the real file — don't redraw the mark).
- **Lenis smooth-scroll** — intentionally left out of v1 to minimise
  dependencies; easy to add later if wanted.
- **CDN vs. vendored GSAP** — GSAP loads from a CDN per the scope. To make the
  animated version work fully offline, vendor the two GSAP files locally and
  update the `<script>` tags in `index.html`.
