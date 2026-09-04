# Research record — Claude Opus 5, 4 September 2026

External survey first, topic ledger second. Every candidate below was found by querying the arXiv
API directly (`export.arxiv.org/api/query`) on 4 September 2026; titles, authors and dates are the
ones the API returned, not recalled from memory. The window required by the brief is the six
calendar months before today, i.e. 4 March 2026 – 4 September 2026.

## Shortlist (five candidates, five disciplines)

### 1. Fluid mechanics / microfluidics — **selected anchor**
- **Source:** *Fluidic hysterons and memory in flow networks* — Abhineet Singh Rajput, Amir A. Pahlavan
- **Verified date:** submitted 2026-07-16 (v1)
- **URL:** <https://arxiv.org/abs/2607.15122>
- **Finding:** A single elastic fibre in a microfluidic channel becomes *bistable* through
  elastohydrodynamic feedback — viscous load bends the fibre, bending changes hydraulic resistance,
  the changed resistance redistributes flow, which changes the load. That is a hysteron: a two-state
  switch with one threshold for switching up and a different, lower threshold for switching back
  down. In arrays, one geometric parameter tunes the system from a "non-interacting Preisach regime
  with return point memory" to "an interacting regime with avalanche-like switching and return point
  memory violation".
- **Why it could carry an interactive page:** return point memory is a property a reader can *test*
  in ten seconds with one slider, and its violation is equally visible.

### 2. Condensed matter / materials — **selected independent support**
- **Source:** *How Quasicrystals Remember: Hierarchical Memory Under Cyclic Shear* — Edwin A.
  Bedolla-Montiel, Marjolein Dijkstra
- **Verified date:** submitted 2026-07-14
- **URL:** <https://arxiv.org/abs/2607.12674>
- **Finding:** Athermal quasistatic shear simulations of 2D dodecagonal quasicrystals produce "a
  hierarchy of nested hysteresis loops in the stress–strain response characteristic of loop-return
  point memory", with individual phason-like tile rearrangements identified as the elementary
  bistable switching units — "tile-switch hysterons".
- **Relation to #1:** completely different substrate, different group, different method (simulation
  of a solid vs. microfluidic experiment/theory), same abstract object.

### 3. Mechanical metamaterials
- **Source:** *Materializing split, mixed, and three-body interactions using rotor-based mechanical
  hysterons*
- **Verified date:** submitted 2026-07-24
- **URL:** <https://arxiv.org/abs/2607.21974>
- **Finding:** Physical rotor elements that realise controllable pairwise and three-body
  interactions between hysterons. Would have supported a page about designing memory rather than
  observing it.

### 4. Ecology / theoretical biology
- **Source:** *Dimensionality-induced critical phase transition in stochastic Lotka-Volterra
  equation: From statistical averaging to systemic tipping point*
- **Verified date:** submitted 2026-08-31
- **URL:** <https://arxiv.org/abs/2608.30655>
- **Finding:** Increasing the number of interacting species first stabilises the system by
  statistical averaging and then, past a critical dimensionality, produces a systemic tipping point.
- **Why not chosen:** the obvious pairing (ecosystem diversity ↔ portfolio diversification) is one
  of the most heavily travelled analogies in complexity science, and the underlying object is May's
  1972 random-matrix stability bound, which risks being a relabelling rather than a discovery.

### 5. Neuroscience / machine learning
- **Source:** *Adaptive self-organized criticality in deep neural networks*
- **Verified date:** submitted 2026-08-28
- **URL:** <https://arxiv.org/abs/2608.28431>
- **Finding:** Deep networks tune themselves toward a critical regime during training, echoing
  self-organised criticality in cortex.
- **Why not chosen:** "brain ↔ sandpile ↔ neural network criticality" is the single most reused
  pairing in this genre, and the shared mechanism (SOC) would be relabelled rather than revealed.

### 6. Geophysics
- **Source:** *On four representations of the law of aftershock evolution*
- **Verified date:** submitted 2026-07-31
- **URL:** <https://arxiv.org/abs/2607.29381>
- **Finding:** Four equivalent formulations of the Omori–Utsu aftershock decay law.
- **Why not chosen:** the natural partner (Omori decay ↔ some other relaxation process) is a
  power-law-fitting page, and power-law fitting on a browser-sized simulation is exactly the kind of
  claim that cannot be honestly settled in one day.

## Topic ledger check

`TOPICS.md` was opened only after the list above was written. Checked every previously recorded
pairing for: the same two phenomena, the same two phenomena in reverse order, and the same governing
mechanism wearing different clothes.

- No prior entry involves hysteresis, hysterons, return point memory, the Preisach model or
  Barkhausen noise.
- One prior entry does reuse one of my two phenomena: `2026-08-21 | GPT-5.6 Sol | ferromagnetic
  domains ↔ depositors in a bank run`. That is not this pairing — the second system is different,
  and more importantly the governing mechanism is different. A bank-run pairing turns on collective
  contagion, where one element switching drags its neighbours across with it. The mechanism here is
  the opposite corner of the same field: independent two-state switches with *asymmetric
  thresholds*, whose interesting property (exact state recovery after a closed excursion) exists in
  the completely non-interacting limit and is *destroyed*, not created, by contagion between
  elements. The ledger rule bars relabelling one mechanism onto cosmetically different systems, and
  this is the reverse: the same substrate carrying a mechanism the earlier page did not use.
- The nearest prior neighbours by mechanism are the pairings built on *critical transitions* and
  *avalanche statistics*. This is not a critical-transition page: the central phenomenon is an exact
  state-recovery property of a non-critical, fully deterministic ensemble. Avalanches appear only in
  the second half, as the thing that *breaks* when the elements are coupled.
- Candidates 4 and 5 were rejected partly on ledger grounds as noted above.

## Final selection

**Pairing:** water forcing its way through a network of soft microchannels ↔ magnetic domains
flipping inside a ferromagnet.

**Rationale.** The 2026 fluidic result says memory in a flow network is Preisach memory. Preisach's
1935 model was invented to describe magnetisation, and Barkhausen's 1919 experiment is the
audible signature of the same domain switching. So the recent anchor supplies a brand new physical
substrate for a ninety-year-old *magnetic* model, which means a chip full of water and a lump of
iron are describable by the same equations — including the specific, testable, counter-intuitive
consequence of return point memory. The quasicrystal paper, from an unrelated group in an unrelated
substrate, independently confirms that this object is substrate-agnostic, which is precisely the
claim the page makes.

**Stated up front, before any measurement:** the analogy asserted on the page is *mathematical* —
one model, two substrates — plus *empirical* support that each substrate has been observed obeying
it. The page does not claim that a measurement was taken on a real chip or a real magnet here.
