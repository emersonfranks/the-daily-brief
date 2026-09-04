# Research record — Claude Opus 5, 3 September 2026

Search window: sources published or substantially revised on or after 3 March 2026 (six calendar
months preceding today's Pacific date). Searches were run against the live arXiv API and the open
web. Memory was used only to phrase queries; every candidate below came out of a search, and every
date, author list and URL below was read off the fetched record rather than recalled.

## Stage 1 — shortlist (written before `TOPICS.md` was opened)

### Candidate 1 — Social physics / network science

- **Source:** *Absorbing phase transition in a queueing model of coupled adaptive agents*, Alexei
  Vazquez. arXiv:2608.14398v1, submitted **14 August 2026**.
  <https://arxiv.org/abs/2608.14398>
- **Finding:** When agents choose the priority of a shared task rather than drawing it from a fixed
  distribution, the model gains a discontinuous absorbing transition between a "coupled" phase and a
  solitary phase. On a network, attention divides as `1/(k + a)`, which fixes a **critical degree**
  beyond which no coupled state exists. The solitary phase then percolates according to the
  Molloy–Reed criterion with the **second moment truncated at that degree** — which the abstract
  describes as *"formally an attack on hubs, with no attacker."*
- **Why it might support an experiment:** the truncation is a closed-form statement that a scarcity
  mechanism and a deliberate attack produce the same percolation arithmetic. Both sides are cheap to
  simulate in a browser and can be shown side by side.

### Candidate 2 — Dynamical systems / climate

- **Source:** *Early Warning Signals Can Vanish or Amplify: Dimensionality in Complex Systems*,
  Susanne Ditlevsen and Peter Ditlevsen. arXiv:2609.01164v1, submitted **1 September 2026**.
  <https://arxiv.org/abs/2609.01164>
- **Finding:** Rising variance and autocorrelation before a saddle-node bifurcation are not universal.
  If the observable is not aligned with the critical direction, stable orthogonal directions mask the
  warning until the system is almost on top of the bifurcation; damping and red noise can amplify or
  erase it.
- **Why it might support an experiment:** a "you are measuring the wrong axis" interaction is very
  visual. Rejected on the grounds that critical slowing down is the most heavily trodden ground in
  this whole genre and the likeliest ledger collision.

### Candidate 3 — Neuroscience / AMO physics

- **Source:** *Simulating neural network criticality and resource dynamics with Rydberg gases*,
  Mischke, Ott, Fleischhauer and Niederprüm. bioRxiv preprint, **21 July 2026**.
  <https://www.biorxiv.org/content/10.64898/2026.07.21.739801v1>
- **Finding:** Ultracold Rydberg gases reproduce neuronal avalanche statistics — power-law avalanche
  sizes, universal shape collapse, peak temporal correlations near the critical point, and "dragon
  king" events once a resource-replenishment mechanism is added.
- **Why it might support an experiment:** a literal two-domain equivalence, atoms versus cortex.
  Rejected because avalanche/criticality pairings are the single most predictable choice available and
  the interaction reduces to watching a log-log slope.

### Candidate 4 — Ecology / population genetics

- **Source:** *Dormancy stabilizes non-transitive competitive dynamics*, Chacón, González-Casanova,
  Nuñez, Peña-Miller, Pérez and Yang. arXiv:2608.17179v1, submitted **17 August 2026**.
  <https://arxiv.org/abs/2608.17179>
- **Finding:** Seed banks act as a *temporal* refuge for rock–paper–scissors competition: dormant
  lineages re-enter later, extending fixation times and preventing the stochastic collapse to a single
  type. The effect is not reducible to a larger effective population size.
- **Why it might support an experiment:** "memory of the past few generations" as a stabiliser is a
  lovely mechanic. Rejected as the weaker visual — the payoff is a distribution of fixation times.

### Candidate 5 — Soft matter physics

- **Source:** *Proximity to Jamming Governs Acoustic Attenuation in Damped Packings*, Kawamura, Olson,
  Austin, Dijksman, Tighe and Clark. arXiv:2608.28157v1, submitted **28 August 2026**.
  <https://arxiv.org/abs/2608.28157>
- **Finding:** In damped disordered packings there is a pressure-dependent critical frequency above
  which wave propagation stops being coherent continuum motion and becomes localised particle-scale
  scattering; attenuation crosses over from `f²` to `f`.
- **Why it might support an experiment:** a clean measurable exponent crossover. Rejected because
  faithfully simulating a damped contact network in-browser is a full day of work before any pairing
  exists on top of it.

Disciplines represented: social physics/network science, dynamical systems/climate,
neuroscience/AMO physics, ecology/population genetics, soft-matter physics — five candidates across
five broad fields.

## Stage 2 — topic-ledger check (`TOPICS.md`, read after the above was written)

Every pairing already recorded in the ledger was compared against the five candidates, in both
orderings, and against the governing mechanism rather than the surface labels.

- **No ledger entry pairs a social/attention system with network percolation or targeted attack.**
- **Nearest miss:** two ledger entries pair friendship networks with bus waiting times. Those rest on
  the friendship paradox and the inspection paradox — sampling bias in how an average is taken. The
  governing mechanism here is percolation on a degree sequence whose second moment has been truncated.
  Degree heterogeneity appears in both, but as a sampling artefact there and as a connectivity
  threshold here; they are not the same mechanism relabelled, and this candidate was kept.
- Candidates 2 and 3 both reduce to *critical slowing down / criticality near a bifurcation*, which is
  the mechanism most at risk of being a cosmetic relabel of existing entries; both were already
  rejected above on their own merits, and the ledger check reinforced that.
- Candidate 1's governing mechanism — percolation on a degree sequence with a truncated second
  moment — does not appear in the ledger under any labelling.

## Stage 3 — selection

**Selected: Candidate 1.** The paper's own phrase, *"formally an attack on hubs, with no attacker"*,
is a hidden-pattern claim stated by the authors in closed form, which is exactly the kind of thing
this site exists to make tactile. It survives the ledger check, it is cheap enough to simulate
honestly in a browser at 60 fps, and it has a genuine falsifier: if attention-driven dissolution
shattered a scale-free network at the same point as *random* node failure, the analogy to a targeted
attack would be dead, because random failure is the classic control that scale-free networks survive.

The second half of the pairing is older, established science, which the brief permits: percolation
on random graphs (Molloy and Reed, 1995) and the error/attack tolerance of scale-free networks.

### Sources verified for the build

**Primary (the recent anchor).**
*Absorbing phase transition in a queueing model of coupled adaptive agents*, Alexei Vazquez,
arXiv:2608.14398v1, submitted 14 August 2026, primary category physics.soc-ph, cross-listed q-bio.PE.
<https://arxiv.org/abs/2608.14398>
Verified: the abstract states the `1/(k + a)` attention split, the resulting critical degree, the
Molloy–Reed percolation of the solitary phase with the second moment truncated at that degree, and
the phrase "formally an attack on hubs, with no attacker".

**Independent supporting source (the established half).**
*Breakdown of the Internet under intentional attack*, Reuven Cohen, Keren Erez, Daniel ben-Avraham and
Shlomo Havlin, Phys. Rev. Lett. **86**, 3682 (2001); arXiv:cond-mat/0010251v2, submitted 18 October
2000, revised 29 March 2001. DOI 10.1103/PhysRevLett.86.3682.
<https://arxiv.org/abs/cond-mat/0010251>
Verified: the abstract states that removing a fraction of the *most connected* sites disintegrates
scale-free networks that are otherwise resilient to random removal, and analyses the critical fraction
by percolation theory. This is the "with an attacker" half of the pairing, established independently
of and 25 years before the 2026 preprint.

**Further corroboration, cited on the page but not counted toward the two required sources.**

- *Error and attack tolerance of complex networks*, Réka Albert, Hawoong Jeong and Albert-László
  Barabási, Nature **406**, 378–382 (2000); arXiv:cond-mat/0008064. DOI 10.1038/35019019.
  <https://arxiv.org/abs/cond-mat/0008064> — the robust-yet-fragile result that supplies the random
  failure control.
- *Limited communication capacity unveils strategies for human interaction*, Giovanna Miritello, Rubén
  Lara, Manuel Cebrián and Esteban Moro, arXiv:1304.1979 (7 April 2013). Nineteen months of
  communication records from about twenty million people; individuals show a finite capacity limiting
  how many ties they can keep active. <https://arxiv.org/abs/1304.1979> — this is the empirical basis
  for treating attention as the scarce resource, rather than assuming it.
- Molloy and Reed's criterion for a giant component in a random graph with a given degree sequence
  (`⟨k²⟩/⟨k⟩ = 2`) is standard textbook percolation and is named in prose on the page.

## Stage 4 — prediction, written before any measurement

Recorded here so it cannot be quietly revised afterwards.

1. **Predicted:** in the attention model, ties fail only at nodes above a critical degree, so the
   surviving degree sequence is truncated — identical in form to removing the highest-degree nodes.
   **Falsified if:** failures were spread across degrees rather than concentrated at the top.
2. **Predicted:** the giant component of the attention model, as capacity falls, tracks the giant
   component under an explicit degree-descending attack that reaches the same cutoff, to within a few
   percent of network size. **Falsified if:** the two curves diverge substantially at matched cutoff.
3. **Predicted:** random removal of the *same number of nodes* leaves the giant component largely
   intact, reproducing the robust-yet-fragile control. **Falsified if:** random removal collapsed the
   network too — which would mean the page had measured nothing but generic dilution.
4. **Predicted:** the collapse point in both truncated cases sits near the Molloy–Reed condition
   `⟨k²⟩/⟨k⟩ = 2` computed on the surviving degree sequence. **Falsified if:** the measured collapse
   were far from `κ = 2`.

The measured outcomes of all four are in the page's own proof appendix and in the journal entry;
where a measurement disagreed with the prediction, the prediction is left standing above and the
disagreement is reported rather than the prediction edited.
