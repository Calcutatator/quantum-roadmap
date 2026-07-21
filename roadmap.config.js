/* ============================================================================
   roadmap.config.js  —  THE ONLY FILE YOU EDIT TO CHANGE CONTENT OR STATUS
   ----------------------------------------------------------------------------
   "How close is Starknet to being post-quantum secure?"

   The whole scene — how many traffic lights, how they are spaced, where the
   car stops, how full the progress rail is — is generated from this one array.
   There is no CMS, no database, no backend. Edit the text between the quotes.

   TWO THINGS YOU'LL WANT TO DO
   ----------------------------------------------------------------------------
   1. WRITE THE COPY AT A LIGHT   → edit that step's `title` and `body`.
   2. MOVE THE CAR / FLIP A LIGHT → change that step's `status`:
        "done"     → light turns GREEN,  car drives through it
        "current"  → light turns RED,    car STOPS here  ("You are here")
        "upcoming" → light stays UNLIT,  road is visible but untravelled
        "progress" → (optional) light turns AMBER — "started, not finished"

   ADD A STEP    → copy one { ... } block and fill it in.
   REMOVE A STEP → delete its { ... } block.
   The engine re-spaces the road, lights and copy panels automatically.

   RULES THE ENGINE CHECKS FOR YOU (warnings appear in the browser console):
     • There should be exactly ONE "current" step (the red frontier).
     • Steps should read top-to-bottom done → current → upcoming (monotonic).
     • An empty `link` is hidden automatically.
   If NO step is "current" (everything is "done"), the car drives all the way
   to the "Post-Quantum Secure" finish line.

   ⚠️  PLACEHOLDER COPY — the wording below is illustrative scaffolding so the
   page has something to show. Replace it with approved roadmap content before
   this ships. (Content was deliberately deferred in the scope.)
   ========================================================================== */

window.ROADMAP = [
  {
    id: "foundations",
    title: "Cryptographic foundations",
    body: "The proof system is built on hash-based commitments — the family of primitives believed to hold up against quantum attacks.",
    status: "done",
    link: { label: "", url: "" }
  },
  {
    id: "quantum-safe-proofs",
    title: "Quantum-safe validity proofs",
    body: "STARK proofs rely on collision-resistant hashing rather than the elliptic-curve assumptions that a quantum computer would break.",
    status: "done",
    link: { label: "", url: "" }
  },
  {
    id: "pq-research",
    title: "Post-quantum signature research",
    body: "Evaluating lattice- and hash-based signature schemes for accounts, and how they trade off size, speed and security.",
    status: "done",
    link: { label: "", url: "" }
  },
  {
    id: "pq-accounts",
    title: "Post-quantum accounts",
    body: "Bringing quantum-safe keys to accounts through account abstraction — the frontier we're actively working on today.",
    status: "current",
    link: { label: "Read the discussion", url: "" }
  },
  {
    id: "network-rollout",
    title: "Network-wide rollout",
    body: "Making post-quantum signatures the default across wallets, tooling and the wider Starknet ecosystem.",
    status: "upcoming",
    link: { label: "", url: "" }
  },
  {
    id: "pq-finality",
    title: "End-to-end post-quantum security",
    body: "Every layer — proofs, accounts, signatures and settlement — secure against a cryptographically-relevant quantum computer.",
    status: "upcoming",
    link: { label: "", url: "" }
  }
];
