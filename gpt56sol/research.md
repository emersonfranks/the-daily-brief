# Research shortlist

Survey window: 28 February-28 August 2026, checked on 28 August 2026. This shortlist was written before opening `TOPICS.md`.

## 1. Mathematical chemistry and information theory

- **Source:** “Assembly theory: formalizing assembly spaces, discovering patterns and bounds”
- **Authors:** Wawrzyniec Bieniawski, Piotr Masierak, Andrzej Tomski, Szymon Łukaszyk, and Szymon Tworz
- **Verified publication date:** 27 May 2026
- **URL:** [doi.org/10.1098/rsos.260082](https://doi.org/10.1098/rsos.260082)
- **Finding:** The paper formalizes string assembly spaces, derives bounds for assembly index, and reports a counterintuitive inverse relationship between a string’s assembly index and its expected waiting time under uniform random generation. This could become an interactive comparison between a workshop that reuses subassemblies and a random signal that waits for an exact pattern.

## 2. Geophysics and volcano monitoring

- **Source:** “Earthquake Rate Variability in the Auckland Volcanic Field Within a Long-Duration Self-Consistent Earthquake Catalogue”
- **Authors:** S. O’Hagan, C. J. Chamberlain, J. Townend, K. van Wijk, J. L. Hopkins, and M. Soulsby
- **Verified publication date:** 7 June 2026
- **URL:** [doi.org/10.1002/jgo2.70063](https://doi.org/10.1002/jgo2.70063)
- **Finding:** A machine-learning-assisted, manually reviewed catalogue found 328 earthquakes from 2011-2022, more than five times the GeoNet catalogue count, while still measuring a low background rate of about 21 earthquakes per year above magnitude 0.6. This could pair detection thresholds in seismic monitoring with dim-star surveys: changing the instrument changes the visible baseline without changing the underlying world.

## 3. Materials science and surface physics

- **Source:** “Charge-Tunable Directed Self-Assembly for High-Resolution Stretchable Metal Nanowire Conductors”
- **Authors:** Lingying Li, Wanli Li, and Takeo Minari
- **Verified publication date:** 8 June 2026
- **URL:** [doi.org/10.1002/admt.202502377](https://doi.org/10.1002/admt.202502377)
- **Finding:** Short ultraviolet exposure makes modified polymer regions repel polar ink, whereas longer exposure reduces surface charge and lets van der Waals attraction dominate, reversing where silver nanowires settle. The reported method patterned 50 µm conductors that remained responsive at 60% strain. This could pair programmable ink attraction with habitat selection across a landscape whose local preference changes sign.

## 4. Computational social science and collective intelligence

- **Source:** “Unraveling the emergence of collective behavior in networks of cognitive agents”
- **Authors:** Nicola Zomer and Manlio De Domenico
- **Verified publication date:** 21 March 2026
- **URL:** [doi.org/10.1038/s44387-026-00091-5](https://doi.org/10.1038/s44387-026-00091-5)
- **Finding:** In optimization tasks, individually capable language-model agents converged prematurely because of consensus and pattern exploitation; changing network topology alleviated that trap but generally slowed convergence relative to classical particle swarms. This could pair expert committees with flocking search: more capable individuals can produce a less exploratory group.

## 5. Behavioral neuroscience

- **Source:** “From forgetting to remembering: Context-dependent memory recovery after postretrieval disruption”
- **Author:** Joaquín M. Alfei
- **Verified online date:** 12 March 2026; issue publication June 2026
- **URL:** [doi.org/10.1037/bne0000651](https://doi.org/10.1037/bne0000651)
- **Finding:** The study reports that memory apparently lost after post-retrieval disruption can recover depending on retrieval context. This could pair memory access with a radio receiver: the trace may persist while the cue determines whether it can be tuned back in.

## Provisional selection and falsification rule

The assembly-index finding is the strongest browser-sized experiment because both quantities can be computed from the same short string and shown simultaneously without pretending that a visual analogy is empirical equivalence. The provisional thesis is: **a pattern can be cheap to construct from reusable pieces yet slow to appear by chance, because a build recipe and a random wait measure different kinds of difficulty.**

Before using that thesis, the shipped model must exhaustively enumerate equal-length binary strings and compare an exact shortest reusable assembly path with exact pattern waiting time. The thesis is rejected if reuse cost and waiting time do not visibly separate, or if the claimed direction only appears in a hand-picked example.

## Independent context for the provisional selection

- **Source:** “Assembly Theory is an approximation to algorithmic complexity based on LZ compression that does not explain selection or evolution”
- **Authors:** Felipe S. Abrahão, Santiago Hernández-Orozco, Narsis A. Kiani, Jesper Tegnér, and Hector Zenil
- **Published:** 23 September 2024
- **URL:** [doi.org/10.1371/journal.pcsy.0000014](https://doi.org/10.1371/journal.pcsy.0000014)
- **Why it matters:** This independent, peer-reviewed critique proves that assembly index is equivalent to the size of a compressing context-free grammar and argues that it should not be treated as a unique explanation of selection or evolution. The page will therefore present a narrowly scoped string experiment about reusable construction and random waiting, not a claim that assembly index identifies life or reveals a physical generative history.

## Topic-ledger check and final selection

The ledger was opened only after the shortlist above existed. None of its entries pair reusable string construction with random pattern waiting, and none reuse these two phenomena under different labels. The closest information-network topics concern routing, cascades, or synchronization rather than grammar-sized construction and pattern autocorrelation, so this pairing does not collide.

The final selection is **reusable construction ↔ random pattern waiting**. The page will compute the minimum number of binary concatenations for short strings and the exact expected waiting time for those strings in fair independent coin flips. It will explicitly describe this as a mathematical string model inspired by the recent assembly-space result, bounded by an independent critique that identifies assembly index with grammar compression and rejects broader claims about life or selection.
