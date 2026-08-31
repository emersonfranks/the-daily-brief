# Research record — Claude Opus 5, 31 August 2026

Today's Pacific date is 31 August 2026, so the recency window for a discovery anchor is
**1 March 2026 – 31 August 2026**. Every candidate below was found by browsing arXiv listings and
the arXiv API live on 31 August 2026; none was recalled from memory. Titles, authors, submission
dates and URLs were read off the arXiv abstract pages themselves.

## Shortlist (written before opening `TOPICS.md`)

### 1. Biological physics — variance adaptation in navigation
- **Source:** Aniruddha Datta, Shiladitya Banerjee, *Noise-robust navigation from an adaptive
  run-and-tumble policy*
- **Verified date:** submitted 27 August 2026 (v1)
- **URL:** <https://arxiv.org/abs/2608.27751>
- **Finding:** A minimal active-Brownian swimmer whose run-and-tumble policy is derived from an
  optimality principle spontaneously acquires *variance adaptation* — it rescales its sensitivity by
  the noise it is currently experiencing. Adaptation keeps chemotactic drift finite as noise grows,
  while a non-adaptive particle's drift "collapses exponentially". Adaptation also has a cost: it
  degrades performance in quiet environments and needs a tuned adaptation sensitivity.
- **Why it could carry an interactive pairing:** the rule is one line of arithmetic — divide the
  measurement by a running estimate of its own fluctuation scale — and it has a *tradeoff* built in,
  so a slider can show both the rescue and the price.

### 2. Statistical physics / active matter — collectivity as a by-product
- **Source:** Gorka Muñoz-Gil, Andrea López-Incera, Vide Ramsten, Giovanni Volpe, Thomas Müller,
  Hans J. Briegel, *Emergent aggregation from collective foraging*
- **Verified date:** submitted 28 August 2026 (v1)
- **URL:** <https://arxiv.org/abs/2608.28046>
- **Finding:** Reinforcement-learning foragers that see only each other, never the targets, and are
  rewarded only individually, undergo a sharp crossover from environment-tuned individual search to
  scale-agnostic collective search as visual range grows; aggregation appears as a by-product.
- **Why it could carry a pairing:** a crossover in sensing range that flips a population between two
  search strategies is a natural slider.

### 3. Network science — universality of dismantling
- **Source:** Lorenzo Cirigliano, Claudio Castellano, Minsuk Kim, Filippo Radicchi, Hanlin Sun,
  *Criticality and universality in network dismantling*
- **Verified date:** submitted 27 August 2026 (v1)
- **URL:** <https://arxiv.org/abs/2608.27613>
- **Finding:** An adaptive biased percolation process that optimally dismantles a network shows a
  universal phase transition in which the giant connected component and the largest 2-core vanish
  abruptly and *simultaneously*, across networks with markedly different degree distributions.
- **Why it could carry a pairing:** two structural quantities dying at the same instant is a strong
  visual, and topology-independence is a genuine surprise.

### 4. Soft matter / fluid mechanics — memory without moving parts
- **Source:** Abhineet Singh Rajput, Amir A. Pahlavan, *Fluidic hysterons and memory in flow
  networks*
- **Verified date:** submitted 16 July 2026 (v1)
- **URL:** <https://arxiv.org/abs/2607.15122>
- **Finding:** A single elastic fibre in a microfluidic channel becomes bistable purely through
  elastohydrodynamic feedback, realising a hysteron. Arrays cross from a non-interacting Preisach
  regime with return-point memory to an interacting regime with avalanches and return-point-memory
  violation as one geometric parameter is varied.
- **Why it could carry a pairing:** return-point memory and its violation is a tactile,
  drag-the-drive-and-come-back interaction.

### 5. Systems engineering / computing — synchronisation without a clock
- **Source:** Brieuc Le Roux Tardif, *Do Co-Located AI Training Jobs Synchronize? Load-Dependent
  Throttling as a Coupling Mechanism for Phase-Locking Behind a Shared Power Cap*
- **Verified date:** submitted 22 July 2026 (v1)
- **URL:** <https://arxiv.org/abs/2607.19638>
- **Finding:** Independent AI training jobs sharing one oversubscribed power envelope are a
  generalized Kuramoto system whose coupling channel is load-dependent throttling. The coupling is
  repulsive to leading order and becomes attractive only once the control loop's phase lag exceeds
  half a cycle; onset is first-order and hysteretic.
- **Why it could carry a pairing:** datacentre power draw phase-locking like fireflies is vivid.

### 6. Mathematical physics / climate dynamics — tipping beyond critical slowing down
- **Source:** Mickaël D. Chekroun, Valerio Lucarini, *Beyond Critical Slowing Down: Slow Modes,
  Extreme Tails, and Field Decoherence in Tipping Transitions*
- **Verified date:** submitted July 2026 (arXiv listing for nlin.AO, July 2026)
- **URL:** <https://arxiv.org/abs/2607.11350>
- **Finding:** Early-warning signals for tipping are richer than critical slowing down alone; slow
  modes, extreme tails and spatial field decoherence carry additional precursor information.
- **Why it could carry a pairing:** early-warning signals map onto many domains.

Disciplines represented: biological physics, statistical physics / active matter, network science,
soft condensed matter / fluid mechanics, systems & control engineering, mathematical physics /
climate. Six candidates across six broad disciplines.

## Topic-ledger check (`TOPICS.md`, read only after the shortlist above was written)

The ledger's 26 entries are dominated by three governing mechanisms: **synchronisation of coupled
oscillators** (fireflies and power grids, in five separate entries), **percolation / cascade
thresholds** (wildfire, porous rock, composite conductivity, bank runs, reply-all storms, nuclear
chain reactions), and **self-organised criticality** (sandpiles and neural avalanches, twice).
Against that:

- **Candidate 5 (co-located training jobs phase-locking)** — rejected outright. The paper itself
  calls it "a generalized Kuramoto system". The ledger already carries firefly ↔ power-grid five
  times over. Swapping fireflies for GPUs is precisely the cosmetic relabel the rule forbids.
- **Candidate 3 (network dismantling)** — rejected. It is a percolation transition, and the ledger
  carries percolation under several costumes already.
- **Candidate 6 (tipping / early warning)** — rejected. Critical slowing down at a bifurcation is
  the same threshold-and-cascade family.
- **Candidate 4 (fluidic hysterons)** — rejected on mechanism overlap with the driven-disordered-
  medium and threshold entries, and because hysteresis is close to `mammalian coat pigmentation ↔
  desert vegetation patterning`-style pattern-selection territory already occupied.
- **Candidate 2 (emergent aggregation from collective foraging)** — rejected. `2026-08-28 | Gemini
  3.7 Flash | microbial quorum-sensing motility ↔ supernova-regulated starburst cavities` already
  covers density-dependent collective motility, and training a reinforcement-learning population
  honestly inside a browser page is not feasible; a hand-tuned stand-in would be an illustration
  rather than an experiment.

**A near-miss I want on the record.** The ledger contains `2026-08-24 | GPT-5.6 Sol | olfactory
sensory adaptation ↔ bacterial chemotaxis memory`. Chemotaxis therefore already appears once. I
considered this carefully and concluded it is not a collision, for two reasons. First, the pairing
is not repeated in either order: that entry pairs one sensory system with another sensory system,
both biological; this one pairs a noisy-gradient searcher with a stochastic gradient-descent
optimizer. Second, and more importantly, the governing mechanism is different. That entry's stated
subject is *memory* — adaptation to the running **mean** of the input, the first moment, which is
what produces fold-change detection and perfect adaptation. This page is about adaptation to the
running **variance**, the second moment, which is a different operation with a different consequence
and is exactly the thing the August 2026 preprint reports as previously unexplored in navigation. I
have not read that build (`AGENTS.md` forbids it), so I am judging on the ledger line alone, which
is all the ledger is meant to expose. To keep the distance visible I have kept the page's subject
firmly on gain control under noise, and I name *E. coli* only where the supporting experiment
requires it.

**Selected: candidate 1, Datta & Banerjee (arXiv:2608.27751).** Its governing mechanism —
divisive gain control, dividing a measurement by a running estimate of its own fluctuation scale —
appears nowhere on the ledger. It also comes with a stated cost, which gives the page falsifiable
predictions in two directions rather than one.

## Sources verified for the selected finding

**Primary (the recent anchor).**
Aniruddha Datta and Shiladitya Banerjee, *Noise-robust navigation from an adaptive run-and-tumble
policy*, arXiv:2608.27751 [physics.bio-ph], submitted 27 August 2026.
<https://arxiv.org/abs/2608.27751> · DOI <https://doi.org/10.48550/arXiv.2608.27751>
Abstract page opened and read on 31 August 2026. It states, verbatim: "Variance adaptation, the
rescaling of sensitivity to noise, is common in sensory systems, but its role in navigation is
unexplored… Adaptation keeps chemotactic drift finite as noise grows, while a non-adaptive
particle's collapses exponentially. Adaptation also carries a cost, degrading performance in quiet
environments and requiring a tuned adaptation sensitivity." That is exactly the statement this page
makes and then tests.

**Independent supporting source.**
Milena D. Lazova, Tanvir Ahmed, Domenico Bellomo, Roman Stocker, Thomas S. Shimizu, *Response
rescaling in bacterial chemotaxis*, Proceedings of the National Academy of Sciences 108(33):
13870–13875, published August 2011. DOI <https://doi.org/10.1073/pnas.1108608108> · free full text
<https://europepmc.org/articles/PMC3158140>
Record retrieved from the Europe PMC REST API on 31 August 2026 (PMID 21808031, PMCID PMC3158140).
Its abstract states that "Sensory systems rescale their response sensitivity upon adaptation
according to simple strategies that recur in processes as diverse as single-cell signaling, neural
network responses, and whole-organism perception," and reports FRET and microfluidics measurements
showing that *E. coli* chemotaxis performs fold-change detection — intensity-independent gradient
responses — with an adaptation timescale invariant over a roughly 10,000-fold range of background
concentration.

This is an independent group, an independent decade and an independent method (live-cell FRET and
free-swimming microfluidics, versus a theoretical optimality calculation), and it establishes the
half of the claim that matters most here: real bacteria really do rescale their response, and the
rescaling strategy is one that recurs across unrelated sensory systems.

**One source I wanted and did not use.** I could not open the PNAS article page directly (HTTP 403)
or the PubMed Central mirrors (bot challenge), so the Lazova record above is verified through the
Europe PMC REST API rather than by reading the typeset paper. The API returns the publisher's own
abstract text, so the quotation is the authors' wording, but I have not read the full paper and the
page does not claim any result from it beyond what its abstract states.

## The pairing

**A bacterium climbing a noisy chemical gradient ↔ a machine-learning optimizer descending a noisy
loss surface.**

The recent anchor supplies the left-hand side and the mechanism. The right-hand side is older,
settled engineering: RMSProp (Tieleman & Hinton, Coursera lecture 6e, 2012) and Adam (Kingma & Ba,
2014) both divide the current gradient estimate by a running root-mean-square of recent gradient
estimates. That is the same map as variance adaptation. The analogy is **mathematical, not
empirical**: nobody has measured a bacterium and an optimizer side by side. What this page does is
run one update rule under two sets of labels and measure whether the rule's behaviour under noise is
the same in both dresses — and then report what it found, including where the correspondence broke.

## Prediction registered before measuring

Written down first, so the measurement could kill it:

- **P1.** With gain adaptation on, drift efficiency falls off as a power law in the noise level with
  exponent near −1.
- **P2.** With gain adaptation off, drift efficiency falls off *faster than any power law* — the
  anchor's word is "exponentially".
- **P3.** Below some crossover noise level the adaptive agent is measurably *worse* than the
  fixed-gain agent, because normalisation throws away the strength of a clean signal.
- **Falsifiers.** P1 dies if the adaptive exponent is not near −1. P2 dies if the fixed-gain agent's
  fall-off is also a clean power law of similar exponent. P3 dies if adaptive is at least as good as
  fixed at every noise level tested.

What actually happened to P1, P2 and P3 when measured on the shipped code is recorded on the page
itself and in `JOURNAL.md`, including the part that did not survive.
