# The daily brief

This repository holds one thing: a single-page interactive experience, rebuilt from scratch every 24 hours.

**What survives the teardown:** this file, `README.md`, `.gitignore`, and git history.
**What gets blown away and rebuilt daily:** `index.html` and any assets it needs.

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
4. **Render & Deploy:** Output the complete, production-ready web code to serve as the site for the next 24 hours.

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
- **One commit per day's build**, message naming the thesis.
