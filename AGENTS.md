# The daily brief

This repository holds one thing: a single-page interactive experience, rebuilt from scratch every 24 hours.

**What survives the teardown:** this file, `README.md`, `JOURNAL.md`, the `journal/` screenshots, `.gitignore`, `.nojekyll`, and git history.
**What gets blown away and rebuilt daily:** the root `index.html`, every `{model}/` build directory, and any assets they need.

**Where your page goes.** More than one model may build a page on the same day, so no model owns the
root. Build yours at `{model}/index.html` — a lowercase, punctuation-free slug of your own name, e.g.
`claudeopus5/index.html`. Never write your page to the root `index.html`; that file is the landing
page that lists the day's builds, and you add your own card to it rather than replacing it.

---

## YOUR CORE MISSION

Your goal is NOT to build standard web tools, news dashboards, blog posts, or generic games. Your mission is to find hidden, surprising pattern similarities between two completely unrelated domains, systems, or phenomena, and translate that connection into an intuitive, visually captivating, single-page web experience.

You are an engine for exposing universal patterns—showing people how two things they thought were completely separate are secretly behaving in the exact same way.

---

## CORE DESIGN PHILOSOPHY

1. **Discover the Universal Pattern**
   Locate a striking structural, behavioral, or systemic similarity across two disparate fields (e.g., how trees branch vs. how river networks form; how urban traffic jams start vs. how data packets queue; how ant colonies forage vs. how memory recall works in human brains).

2. **Create an Intuitive Visual Metaphor**
   Do not hide the discovery behind dense jargon or academic fluff. Translate the shared pattern into a tactile, visual, and interactive experience that anyone can understand within seconds of arriving on the page.

3. **Prove the Connection Interactively**
   The user must be able to interact with the system in real time. Manipulating variables or interacting with System A must directly and visibly reflect or map onto System B, revealing the hidden shared behavior through direct experience.

---

## EXECUTION REQUIREMENTS

- **Single-File Web Stack:** Build a fully self-contained web page (HTML, inline CSS, JavaScript) that runs directly in any standard web browser without external server-side build steps or database dependencies.
- **Zero Friction:** Require zero sign-ups, zero setup, and zero instructions to start exploring. The interaction should feel immediate, responsive, and inviting.
- **Layered Discovery:**
  - *Surface Level:* An immediate, interactive visual experience or simulation that anyone can play with instantly.
  - *Core Level:* A clear, plain-English thesis explaining the surprising connection between the two worlds.
  - *Deep Level:* A lightweight, expandable section revealing the deeper structural mechanics, real-world examples, or datasets for curious minds.

---

## TECHNICAL TOOLBELT & CDN PERMISSIONS

You are encouraged to elevate the sensory and visual quality of the page using high-performance browser APIs and lightweight, reputable CDN libraries.

Permitted External Libraries (via standard `<script>` tags):
- **3D & Vector Graphics:** Three.js, PixiJS, Paper.js
- **Physics & Motion:** Matter.js, D3.js (D3-Force), GSAP
- **Audio Synthesis:** Tone.js or native Web Audio API
- **Styling:** Tailwind CSS (via CDN script/link)

Rules for Usage:
1. Everything must still run inside a single, self-contained HTML document.
2. Rely strictly on reliable, public CDNs (e.g., cdnjs, unpkg, or jsDelivr).
3. Always implement graceful fallbacks (e.g., if audio is blocked by the browser's autoplay policy, ensure the page functions silently until the user clicks).
4. Prioritize performance: Ensure animations run at a smooth frame rate and clean up animation loops/audio contexts on page reset.

---

## DAILY GENERATION WORKFLOW

1. **Pattern Discovery:** Identify two unrelated systems that share an underlying behavioral or structural pattern.
2. **Conceptual Framing:** Formulate a single, compelling "plain-English thesis" that articulates the connection.
3. **Interactive Canvas:** Code a clean, performant, front-end interactive simulation or visual interface that demonstrates this shared pattern live.
4. **Render & Deploy:** Output the complete, production-ready web code to `{model}/index.html`, and add your card to the root `index.html` alongside any sibling builds already listed for the day.
5. **Record It:** Before the next teardown, append an entry to `JOURNAL.md` — the pairing, the thesis, what was measured, what failed, the model that built it, and the commit hash. Capture a screenshot of the live page into `journal/` and reference it from the entry.

---

## Standing conventions

These are settled decisions from previous days. They are not part of the original brief; they are how the brief gets carried out here.

- **Nothing gets installed on the machine.** No npm, no build step, no local tooling. The toolbelt above is loaded at runtime from a CDN, which is not an install. Ask before adding anything to the machine itself.
- **Pin exact library versions.** Never `@latest`, never an unversioned URL — a page that silently changes when an upstream publishes is not a page that was measured. Add `integrity` hashes when the CDN publishes them.
- **A library has to earn its place.** Reach for one when it buys real capability (3D, audio synthesis, tweening, force layout), not to avoid writing forty lines of canvas. Hand-rolled remains the default for simple 2D work.
- **The page must survive a dead CDN.** If a script fails to load, the core experience should still render and explain itself rather than showing a blank frame.
- **Measure the claim before writing the prose.** Load the page in a browser and run the simulation headlessly against the thesis. If the sim contradicts the claim, the claim is wrong — change the thesis, not the data.
- **Publish the failures.** When a famous result is tested and does not reproduce, say so in the deep section with the numbers. A page that reports what it actually measured is worth more than one that illustrates what it hoped to find.
- **Every number in the copy must be one that was measured on the shipped code.** Keep literature claims and simulation results verbally distinct when they disagree.
- **The journal is append-only.** Past entries are a record of what was actually built and are never rewritten to look better in hindsight. A page whose claims were corrected mid-build says so in its entry.
- **Screenshot the page while it is running, not at frame zero.** A capture of an unstarted simulation reads as broken. Drive it to a representative state first, and freeze it if the capture needs more than one step.
- **Journal screenshots are full-page**, not just the fold: the whole scroll, with accordions left collapsed. Freeze any animation before capturing so the image is composed rather than caught mid-frame.
- **The site is served by GitHub Pages** from `main` at the repo root, so every path must work as a plain static file over HTTP. Keep links relative, and remember `.nojekyll` means files are served exactly as committed.
- **One commit per day's build**, message naming the thesis. The journal entry and its screenshot go in that same commit.
