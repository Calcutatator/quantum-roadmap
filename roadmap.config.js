/* ============================================================================
   roadmap.config.js  —  THE ONLY FILE YOU EDIT TO CHANGE CONTENT OR STATUS
   ----------------------------------------------------------------------------
   "How close is Starknet to being post-quantum secure?"

   The whole scene — how many traffic lights, how they are spaced, where the
   car stops, how full the progress rail is — is generated from this one array.
   There is no CMS, no database, no backend. Edit the text between the quotes.

   FIELDS
   ----------------------------------------------------------------------------
     id      : unique slug
     title   : heading shown at the light AND at the top of its pop-up
     body    : one short line shown on the drive-by card
     status  : "done" | "current" | "upcoming"   (see the light rules below)
     detail  : the pop-up explainer — "what it is" (1–3 sentences)
     hurdle  : the pop-up explainer — "the challenge" (1–2 sentences; optional)
     link    : { label, url } shown at the bottom of the pop-up (blank = hidden)

   LIGHT / CAR RULES (derived automatically from status + car position)
   ----------------------------------------------------------------------------
     • Any sign the car HAS NOT reached yet glows AMBER  ("ahead").
     • A "done" sign flicks GREEN as the car passes it.
     • The single "current" sign glows RED — the car STOPS here ("You are here").
     • The sign you're stopped at gently breathes; hovering a sign brightens it;
       clicking a sign opens its pop-up explainer.
   If NO step is "current" (all done), the car drives to the finish line.

   ADD a step → copy one { … } block.   REMOVE a step → delete its block.
   Warnings for missing/duplicate "current" or mis-ordered steps show in the
   browser console.

   ⚠️  PLACEHOLDER COPY — the wording below is illustrative scaffolding so the
   page has something to show. Replace it with approved roadmap content, and add
   the right `link` per step, before this ships.
   ========================================================================== */

window.ROADMAP = [
  {
    id: "foundations",
    title: "Cryptographic foundations",
    body: "Security built on hash-based commitments — believed to resist quantum attack.",
    status: "done",
    detail: "Starknet's security rests on STARK proofs, which are built from hash functions rather than the number-theoretic problems (like elliptic curves) that a quantum computer would break. That makes the proof layer quantum-resistant by design, from day one.",
    hurdle: "The foundation was the easier part. The harder work is extending that same resistance to every other layer — especially the keys users sign with.",
    link: { label: "", url: "" }
  },
  {
    id: "quantum-safe-proofs",
    title: "Quantum-safe validity proofs",
    body: "STARK proofs rely on hashing, not the assumptions a quantum computer breaks.",
    status: "done",
    detail: "Every Starknet transaction is settled with a validity proof. Because those proofs depend only on collision-resistant hashing, a future quantum computer gains no shortcut to forge them — the integrity of the chain's computation is already post-quantum.",
    hurdle: "Proofs protect what happened on-chain, but not the signatures that authorise transactions in the first place. Closing that gap is what the later steps are about.",
    link: { label: "", url: "" }
  },
  {
    id: "pq-research",
    title: "Post-quantum signature research",
    body: "Choosing quantum-safe signature schemes for accounts.",
    status: "done",
    detail: "Signatures are how accounts prove ownership, and today's schemes would be broken by a large quantum computer. This step is the research to select quantum-safe signature schemes, weighing security against real-world costs.",
    hurdle: "Post-quantum signatures are larger and heavier than today's. The challenge is adopting them without making wallets slow or transactions expensive.",
    link: { label: "", url: "" }
  },
  {
    id: "pq-accounts",
    title: "Post-quantum accounts",
    body: "Quantum-safe keys for accounts via account abstraction — the frontier today.",
    status: "current",
    detail: "The frontier we're working on now: giving user accounts quantum-safe keys. Starknet's native account abstraction makes this possible without forcing everyone onto a single scheme — an account can upgrade its own signature logic.",
    hurdle: "The hard part is migration — moving many existing accounts to new key types smoothly, while keeping the experience simple for users and custodians.",
    link: { label: "Read the S2morrow update", url: "https://x.com/StarkWareLtd/status/2039330384350007559?s=20" }
  },
  {
    id: "network-rollout",
    title: "Network-wide rollout",
    body: "Making post-quantum signatures the default across the ecosystem.",
    status: "upcoming",
    detail: "Once accounts can use quantum-safe keys, the next step is making them the norm — across wallets, developer tooling and infrastructure — so the whole ecosystem benefits by default rather than opt-in.",
    hurdle: "Coordination. Wallets, apps and services need to support the new schemes together, so no user is ever left on an insecure path.",
    link: { label: "", url: "" }
  },
  {
    id: "pq-finality",
    title: "End-to-end post-quantum security",
    body: "Every layer secure against a cryptographically-relevant quantum computer.",
    status: "upcoming",
    detail: "The destination: every layer — proofs, accounts, signatures and settlement — resistant to a cryptographically-relevant quantum computer, with no weak link left in the chain.",
    hurdle: "'End-to-end' means the slowest-moving component sets the pace. The goal is to close the last gaps before large quantum computers arrive, not after.",
    link: { label: "", url: "" }
  }
];
