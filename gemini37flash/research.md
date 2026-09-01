# Research Shortlist — 2026-09-01

Survey of recent scientific literature (March 1, 2026 – September 1, 2026) across distinct disciplines to identify universal cross-domain physical mechanisms.

---

## Candidate Findings

### 1. Astrophysics & Stellar Hydrodynamics
- **Title:** Accretion Rates and Thermohaline Convection in Polluted White Dwarfs
- **Authors:** J. R. Fuentes, Matias Castro-Tapia, Jim Fuller
- **Verified Date:** 2026-08-31
- **URL:** https://arxiv.org/abs/2608.31110 (arXiv:2608.31110v1)
- **Discipline:** Astrophysics / Fluid Dynamics
- **Finding:** Accretion of metal-rich exoplanetary debris onto hydrogen/helium white dwarfs creates an inverted mean molecular weight gradient in a thermally stable envelope. Because thermal energy diffuses orders of magnitude faster than chemical ions ($\kappa_T \gg \kappa_\mu$), the envelope develops double-diffusive "thermohaline" fingering convection identical to oceanographic salt fingers. This fingering convection dictates the stellar sinking timescale and sets the inferred accretion rates for planetary debris.
- **Potential Pairing:** Oceanic Salt Fingers $\leftrightarrow$ Stellar Exoplanet Accretion in Polluted White Dwarfs (Double-Diffusive Fingering Convection).

### 2. Biophysics & Cellular Morphogenesis
- **Title:** Classification of Intracellular Protein Patterns from Reactive Equilibria
- **Authors:** Henrik Weyer, Ching Yee Leung, Erwin Frey
- **Verified Date:** 2026-08-13
- **URL:** https://arxiv.org/abs/2608.13821 (arXiv:2608.13821v1)
- **Discipline:** Biophysics / Non-equilibrium Physics
- **Finding:** Multi-component intracellular protein networks (such as MinCDE in *E. coli*) operate via mass-conserving reaction-diffusion (MCRD) systems where total protein copy numbers are conserved between cytosol and membrane, producing localized poles and traveling waves without requiring Turing's classic activator-inhibitor ratio imbalances.
- **Potential Pairing:** Bacterial Cell Division Poles $\leftrightarrow$ Desert Vegetation Banding (Mass-Conserving Reaction-Diffusion).

### 3. Soft Matter & Granular Rheology
- **Title:** Intercoupling of Segregation and Rheology in Spatially Developing Granular Chute Flows
- **Authors:** Soniya Kumawat, Sayeedul Islam Sheikh, Satyabrata Patro
- **Verified Date:** 2026-08-31
- **URL:** https://arxiv.org/abs/2608.30994 (arXiv:2608.30994v1)
- **Discipline:** Condensed Matter / Granular Mechanics
- **Finding:** In binary granular flows down inclined chutes, particle size and density disparities drive kinetic sieving and squeeze expulsion, coupling local shear strain to spontaneous segregation into coarse top layers and fine basal layers.
- **Potential Pairing:** Granular Avalanche Size Segregation $\leftrightarrow$ Fluvial Sediment Bedload Sorting.

### 4. Complex Systems & Ecology
- **Title:** Resource supply dynamics control stability and chaos in complex ecosystems
- **Authors:** Jamila Rowland-Chandler, Akshit Goyal, Wenying Shou
- **Verified Date:** 2026-08-31
- **URL:** https://arxiv.org/abs/2608.30966 (arXiv:2608.30966v1)
- **Discipline:** Ecology / Nonlinear Dynamics
- **Finding:** In multi-species microbial and ecological networks, consumer-resource feedback delays combined with pulsed vs. continuous resource supply dictate a sharp bifurcation from stable coexistence to high-dimensional non-equilibrium chaos.
- **Potential Pairing:** Microbial Trophic Competition $\leftrightarrow$ Financial Market Liquidity Cycles.

### 5. Active Matter & Non-reciprocal Physics
- **Title:** Scaling behavior in non-reciprocal and odd conserved dynamics near criticality
- **Authors:** Martin Kjøllesdal Johnsrud, Giulia Pisegna, Ramin Golestanian
- **Verified Date:** 2026-08-05
- **URL:** https://arxiv.org/abs/2608.05027 (arXiv:2608.05027v1)
- **Discipline:** Statistical Physics / Active Matter
- **Finding:** Non-reciprocal microscopic forces in conserved active systems break time-reversal symmetry and action-reaction symmetry, yielding macroscopic traveling density waves and odd transport coefficients near critical phase transitions.
- **Potential Pairing:** Synthetic Colloidal Flocks $\leftrightarrow$ Chiral Atmospheric Jet Streams.

---

## Ledger Check & Final Selection Rationale

- **Candidate 1 (Double-Diffusive Fingering Convection: Oceanic Salt Fingers $\leftrightarrow$ Polluted White Dwarf Exoplanet Accretion):**
  - *Ledger Check:* No previous topic in `TOPICS.md` touches double-diffusive convection, thermohaline staircases, differential scalar transport, or stellar planetary accretion mixing. Zero collision.
  - *Feasibility:* Can be directly simulated headlessly and visually using a high-fidelity 2D Boussinesq two-component fluid simulation (Navier-Stokes with thermal diffusion $\kappa_T$, solute/heavy-ion diffusion $\kappa_S$, and buoyancy).
  - *Primary Source:* J. R. Fuentes, Matias Castro-Tapia, Jim Fuller, "Accretion Rates and Thermohaline Convection in Polluted White Dwarfs", arXiv:2608.31110 (2026-08-31).
  - *Independent Supporting Source:* R. W. Schmitt, "Double Diffusion in Oceanography", *Annual Review of Fluid Mechanics* 26, 255–285 (1994) / M. E. Stern, "The 'salt-fountain' and thermohaline convection", *Tellus* 12, 172–175 (1960).
  - *Decision:* **SELECTED**.

- **Candidate 2 (Mass-Conserving Reaction-Diffusion):**
  - *Ledger Check:* Desert vegetation patterning was used on 2026-08-23. Rejected to avoid partial domain overlap.

- **Candidate 3 (Granular Chute Flow Segregation):**
  - *Ledger Check:* Grain silo draining was touched on 2026-08-20. Distinct, but Candidate 1 has a stronger cross-domain leap (Oceanography $\leftrightarrow$ Stellar Astrophysics).

- **Candidate 4 (Resource Supply Chaos):**
  - *Ledger Check:* Ecosystem stability / criticality touched on 2026-08-31 and 2026-09-01. Rejected due to thematic proximity.

- **Candidate 5 (Active Matter Odd Conserved Dynamics):**
  - *Ledger Check:* Active matter motility was touched on 2026-08-28.

### Selected Anchor
- **System A:** Oceanic Salt Fingers (Subtropical Thermocline)
- **System B:** Metal-Polluted White Dwarf Accretion Mantles
- **Governing Mechanism:** Double-Diffusive Fingering Convection driven by differential scalar diffusivities ($\tau = \kappa_S / \kappa_T \ll 1$) across an inverted compositional gradient stabilized by a thermal gradient.

