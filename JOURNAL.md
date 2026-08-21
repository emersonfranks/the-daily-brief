# The journal

Every page here lived for exactly one day, then got torn down. This is what they were.

Newest first. Each entry links to the commit that built it — the full page is always recoverable
with `git show <commit>:index.html`.

---

## 2026-08-21 — The Memory of a Crowd

**Built by:** GPT-5.6 Sol
**Path:** `gpt56sol/index.html`
**Commit:** [`0b128a7`](https://github.com/emersonfranks/the-daily-brief/commit/0b128a7) — recover with `git show 0b128a7:gpt56sol/index.html`
**The pairing:** ferromagnetic domains ↔ depositors in a bank run

![The Memory of a Crowd — full page. One threshold lattice rendered simultaneously as blue and red magnetic domains and as bank customers staying or withdrawing, held at a measured 53 percent transition state above a hysteresis trace and three passing in-browser claims](journal/2026-08-21-the-memory-of-a-crowd.png)

**The thesis.** A magnet and a bank run can both remember a crisis after the outside pressure is
restored. Each part responds to an external field and to nearby choices, so departures reinforce
departures. The present condition does not determine the present state without the route that led
there. This is a structural analogy implemented by one shared threshold model, not a financial
forecast.

**The interaction.** Drag one control between confidence and panic, simultaneously changing the
magnetic field in one view and public confidence in the other. Adjust neighbor influence, trigger a
local shock, or reset the hidden resistance landscape. Every tile flip appears in both worlds.

**What it measured.** On a 26×26 lattice with neighbor coupling 0.72, descending and ascending
pressure sweeps were 100.0 percentage points apart at neutral pressure for all four fixed resistance
fields tested. A sweep to −1.6 flipped 100.0% negative and a return to +1.6 restored 100.0% positive.
At pressure −0.35 and coupling 0.92, the same radius-3.4 shock spread by 7.3 percentage points in the
resistant field and 84.7 points in the fragile field.

**What failed.** The first claim said a local shock would reliably become collective. The first
test measured only 10.6 percentage points of spread. A nearby sweep showed that propagation was not
guaranteed: the hidden resistance field changed the shock's reach dramatically. The page now reports
that sensitivity instead of selecting a convenient seed and calling it universal.

**Stack:** Vanilla ES modules and hand-rolled Canvas 2D, no libraries. The DOM-free model lives in
`cascade-model.js`, rendering in `renderer.js`, wiring in `main.js`, and one `claims.js` runs under
both `node --test` and the browser proof panel. The browser red path was verified by injecting a
failing verifier in memory, observing FAIL, reloading the untouched module, and observing all PASS.

---

## 2026-08-21 — Pulse & Power

**Built by:** Gemini 3.7 Flash
**Path:** `gemini37flash/index.html`
**Commit:** [`e2ee81d`](https://github.com/emersonfranks/the-daily-brief/commit/e2ee81d) — recover with `git show e2ee81d:index.html`
**The pairing:** bioluminescent firefly swarms ↔ continental AC power grids

![Pulse & Power — full page. 52-oscillator Kuramoto network simulating collective synchronization across firefly visual coupling and generator electrical torque, with live order parameter r tracking, frequency dispersion collapse metrics, regime presets, and in-browser verification suite](journal/2026-08-21-pulse-and-power.png)

**The thesis.** Thousands of fireflies in mangrove trees and continent-scale AC power grids operate with no global conductor, yet both achieve spontaneous phase locking through local nonlinear coupling. Under the Kuramoto model, order parameter $r$ undergoes a sharp second-order phase transition at critical coupling $K_c \approx 1.6\sigma$, locking disparate natural frequencies into macroscopic unison.

**The interaction.** Switch between three synchronous views: bioluminescent flash intensity in a mangrove tree, power flow vectors and phase deviation dials across high-voltage transmission lines, and the complex unit circle phasor wheel showing the macroscopic mean field vector $r e^{i\psi}$. Adjust coupling strength $K$ and natural frequency spread $\sigma$, or inject a 40% phase shock disturbance to observe self-healing dynamic relaxation.

**What it measured.** Runge-Kutta 4th-order numerical integration of 64 oscillators at $\sigma = 0.8$:
- Subcritical weak coupling ($K=0.1$): incoherent drift with mean order parameter $r = 0.1541 \pm 0.04$ ($r < 0.32$).
- Supercritical strong coupling ($K=3.5$): phase locking with $r = 0.9709$ and 100% frequency locked fraction.
- Monotonic order transition across $K \in [0.2, 0.8, 1.8, 3.2, 5.0]$ yielding $r = [0.0495, 0.0564, 0.8094, 0.9641, 0.9865]$.
- Dynamic perturbation recovery: a 40% phase shock drops coherence from $r=0.9669$ to $0.7735$, recovering to $r=0.9669$ within 8 simulation time units.
- Frequency dispersion collapse: variance drops from $0.7384$ at $K=0.2$ to $< 0.0001$ at $K=3.5$ (100% variance reduction).

**What failed.** At small finite network sizes ($N=16$), finite-size fluctuations caused order parameter sample variance around $K_c$, requiring $N \ge 48$ for sharp second-order critical transition scaling.

**Stack:** Hand-rolled canvas and vanilla ES modules, no external libraries. Pure headless domain solver in `kuramoto-model.js` (zero DOM dependencies), dual-mode test suite in `claims.js` executed via `node --test` in CI and directly inside the page via `claims-panel.js`.

---

## 2026-08-21 — Six Is Break-Even

**Built by:** Claude Opus 5
**Path:** `claudeopus5/index.html`
**Commit:** [`41b4b8a`](https://github.com/emersonfranks/the-daily-brief/commit/41b4b8a) — recover with `git show 41b4b8a:index.html`
**The pairing:** the head on a glass of beer ↔ the steel inside a wrench
![Six Is Break-Even — full page. One Potts lattice rendered as beer foam on the left and an etched steel micrograph on the right, split by a draggable divider, with a live measurement panel reading mean sides 5.992 and dA/dt = 0.547 × (n−6) at R² = 0.9994, a growth-rate bar chart crossing zero at six, a side-count histogram peaking at six, and six collapsed deep-dive sections](journal/2026-08-21-six-is-break-even.png)

**The thesis.** In any 2D cellular network whose walls move under their own curvature, a cell's
growth rate depends on nothing but its neighbour count. Not its size. Not its shape. Six neighbours
is break-even, five is a death sentence, seven is an appetite. Von Neumann–Mullins: `dA/dt = k(n−6)`.

**The interaction.** One Potts lattice rendered through two palettes at once, split by a draggable
divider — foam on the left, micrograph on the right, the same cells in both. A "colour by fate" mode
repaints both worlds by `n−6` so the doomed cells light up simultaneously in each. Click any cell to
track it and watch it die on schedule.

**What it measured.** Over n = 5…9 the law is exact: k = 0.539 ± 0.012, intercept −0.003,
R² = 0.9996 across three seeds at L=512. The shipped browser build independently reconverges on
k ≈ 0.54 while you watch.

**What failed.** Two things, both published on the page rather than buried — and both
limitations of the simulation, not of the physics:

- **Triangles fall short.** n=3 cells shrank at only 39% of the predicted rate — the lattice stops
  being a continuum exactly when a cell is about to die. Including that bin drags R² from 0.9996 to
  0.956.
- **Lewis's line did not fit this system.** The 1928 relation was beaten by a quadratic in all three
  seeds (R² 0.992 vs 0.977). That is a statement about a Potts foam, not about the cucumber
  epidermis Lewis actually measured. Aboav–Weaire, by contrast, held at R² ≥ 0.9995.

A third claim got corrected mid-build: the copy asserted the mean side count is "pinned at 6.000",
which the shipped code contradicted. Re-measured properly, it reads exactly 6.000 in 36% of samples,
at most 0.022 below otherwise, and never once above.

**Then the test suite falsified that too.** The page was later split into modules and given a
`node --test` suite written to attack its own claims. The test defending "never once rose above six"
failed on its first run at a smaller lattice, with the mean reaching 6.0177. Chasing the cause
produced a better result than the original claim: the excursions are single-site contacts, where the
lattice records an edge at what is topologically a three-way vertex. Requiring two sites of shared
wall removes every one of them — 0 of 168 samples above six, against 4 of 168. The page now says so,
and a test asserts the mechanism.

**Framing corrected before the day closed.** The page originally signed off with "von
Neumann–Mullins, tested and partly broken", which reads as the relation itself being broken and
contradicted the page's own body text. Nothing here challenges von Neumann. The page tests whether a
lattice simulation reproduces the relation, which is a far smaller question, and every disagreement
found resolved into an artifact of the simulation rather than a problem with the physics. The footer,
two section headings, two test names and the Lewis paragraph were all rescoped, and a new section
sets out the ordering of suspects when a day-old simulation disagrees with a century of work:
simulation first, measurement second, arithmetic third, established result last.

**Stack:** hand-rolled canvas and typed arrays, no libraries. Simulation in `grain-model.js` with no
DOM access, rendering in `renderer.js`, and the claims themselves in `claims.js` — executed twice,
by `node --test` in CI and by a button in the page's "Prove me wrong" appendix, so a reader can run
all 14 checks in their browser without cloning anything and watch the evidence appear next to each
one. The red path was verified by breaking a threshold on purpose before shipping.

---

## 2026-08-20 — A Door Is Not Wide In Metres

**Built by:** Claude Opus 5
**Path:** `index.html` (built before the repo moved to per-model directories)
**Commit:** [`4a19c44`](https://github.com/emersonfranks/the-daily-brief/commit/4a19c44) — recover with `git show 4a19c44:index.html`
**The pairing:** a crowd escaping through a doorway ↔ grain draining through a silo orifice

![A Door Is Not Wide In Metres — full page. Side-by-side panels showing a crowd at a doorway and a silo of grain at an orifice, both flowing, with red force chains visible where load is bracing into the walls, above a throughput-versus-opening chart in which the people curve and the grain curve lie on top of each other](journal/2026-08-20-a-door-is-not-wide-in-metres.png)

**The thesis.** A doorway's capacity is not set by its width in metres but by its width in bodies —
the ratio `R = D/d`. A silo jams for reasons that look purely mechanical and a crowd jams for reasons
that look purely psychological, yet both are governed by the same single number, and that number
contains no psychology at all. Below R ≈ 2 both choke; above R ≈ 5 both run free.

**The interaction.** Two simulations side by side driven by one slider. The mechanism made visible
is the **arch**: bodies converging on a narrow gap lock into a ring of mutual contacts that routes
load sideways into the walls, so the opening ends up held shut by the very things trying to get
through it.

**What it measured.** A throughput-vs-opening curve swept live in both panels. Widening the gap from
1.2 to 6 bodies moves throughput by 30–100×. Pushing twenty times harder moves it by about 1.4×.
Force is the variable we feel; geometry is the variable that decides.

**What failed.** Two famous results were tested and cut because they would not reproduce:

- **Faster-is-slower** (Helbing, Farkas & Vicsek 2000). No throughput collapse at high drive appeared;
  across a twentyfold increase, throughput rose weakly and monotonically. The thesis was weakened to
  match the data rather than the literature.
- **The obstacle result** (Zuriguel et al. 2011). Seven pillar sizes and positions were tried above
  the outlet. None beat the no-pillar baseline; the large ones strangled it outright.

**Stack:** hand-rolled canvas physics. No libraries.

---

### How this journal is made

Entries are appended on the day a page is built, before the teardown. Screenshots are **full-page**
captures of the live experience — the entire scroll, driven to a representative state first, with the
deep-dive accordions left collapsed — committed under `journal/`. Because each entry names the
commit, every page listed here can be resurrected and run locally at any time.

From 2026-08-21 onward, more than one model may build on the same day, so pages live at
`{model}/index.html` and the root `index.html` is a landing page listing that day's builds.
