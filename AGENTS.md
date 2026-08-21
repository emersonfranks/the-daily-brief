# The daily brief

This repository holds one thing: a single-page interactive experience, rebuilt from scratch every 24 hours.

**What survives the teardown:** this file, `README.md`, `JOURNAL.md`, the `journal/` screenshots, `.github/`, `.gitignore`, `.nojekyll`, and git history.
**What gets blown away and rebuilt daily:** the root `index.html`, every `{model}/` build directory, and any assets they need.

**Where your page goes.** More than one model may build a page on the same day, so no model owns the
root. Build yours at `{model}/index.html` — a lowercase, punctuation-free slug of your own name, e.g.
`claudeopus5/index.html`. Never write your page to the root `index.html`; that file is the landing
page that lists the day's builds, and you add your own card to it rather than replacing it.

**This is published, live, to the public internet.** The site is served by GitHub Pages at
<https://emersonfranks.github.io/the-daily-brief/>. **Build, commit, push — that is the whole
deploy.** The `Publish` workflow in `.github/workflows/` takes it from there and the page is live
within a minute or two; there is no manual step and nothing for you to configure. That workflow
first checks the root `index.html` and every relative link on it, so if your card points at a file
you did not commit, the deploy fails loudly instead of publishing a broken landing page. Assume
anything you write will be read by someone who is not the person who asked for it.

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
  - *Proof Level:* A closing appendix where the reader runs the page's own test suite in their browser and watches each claim be checked, with the measured evidence shown next to it.

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
4. **Render & Deploy:** Output the complete, production-ready web code to `{model}/index.html`, and add your card to the root `index.html` alongside any sibling builds already listed for the day. A card carries four things: the model name, the page title, the pairing (`system A ↔ system B`), and a one-sentence hook. Update the date heading if you are the first build of the day; leave existing cards alone.
5. **Record It:** Before the next teardown, append an entry to `JOURNAL.md` — the pairing, the thesis, what was measured, what failed, the model that built it, and the commit hash. Capture a screenshot of the live page into `journal/` and reference it from the entry.

---

## Standing conventions

These are settled decisions from previous days. They are not part of the original brief; they are how the brief gets carried out here.

- **Nothing gets installed on the machine.** No npm, no build step, no local tooling. The toolbelt above is loaded at runtime from a CDN, which is not an install. Ask before adding anything to the machine itself.
- **Never contact npm or any package registry from the build machine.** It sits behind a corporate security control, and even a read-only version lookup against `registry.npmjs.org` trips an alert. A TLS failure reaching a registry is that control saying no — stop, do not retry, and do not route around it with a different tool. If a version number is genuinely needed, ask rather than probing. CI runners are a separate environment and are not covered by this, but prefer solutions that need no registry at all.
- **Pin exact library versions.** Never `@latest`, never an unversioned URL — a page that silently changes when an upstream publishes is not a page that was measured. Add `integrity` hashes when the CDN publishes them.
- **A library has to earn its place.** Reach for one when it buys real capability (3D, audio synthesis, tweening, force layout), not to avoid writing forty lines of canvas. Hand-rolled remains the default for simple 2D work.
- **The page must survive a dead CDN.** If a script fails to load, the core experience should still render and explain itself rather than showing a blank frame.
- **Measure the claim before writing the prose.** Load the page in a browser and run the simulation headlessly against the thesis. If the sim contradicts the claim, the claim is wrong — change the thesis, not the data.
- **Publish the failures.** When a famous result is tested and does not reproduce, say so in the deep section with the numbers. A page that reports what it actually measured is worth more than one that illustrates what it hoped to find.
- **A day-old simulation disagreeing with established science is evidence about the simulation.** Order the suspects honestly: your model first, your measurement second, your arithmetic third, and the century of work behind the published result last. Extraordinary claims require extraordinary evidence, and one page built in 24 hours on one machine is a demonstration, not a refutation. Name the artifact you actually found.
- **Say which question you tested.** "The law is broken" and "my lattice stops resolving the law below four sides" are wildly different claims. Headings, footers and test names must carry the smaller one unless the larger is genuinely earned — a strapline that contradicts the body is still a false claim, even when the body is careful.
- **Every number in the copy must be one that was measured on the shipped code.** Keep literature claims and simulation results verbally distinct when they disagree.
- **The journal is append-only.** Past entries are a record of what was actually built and are never rewritten to look better in hindsight. A page whose claims were corrected mid-build says so in its entry.
- **Screenshot the page while it is running, not at frame zero.** A capture of an unstarted simulation reads as broken. Drive it to a representative state first, and freeze it if the capture needs more than one step.
- **Journal screenshots are full-page**, not just the fold: the whole scroll, with accordions left collapsed. Freeze any animation before capturing so the image is composed rather than caught mid-frame.
- **The site is served by GitHub Pages** from `main` at the repo root, so every path must work as a plain static file over HTTP. Keep links relative, and remember `.nojekyll` means files are served exactly as committed. Verify your page on the live URL after pushing, not only from `file://` — a directory link like `foo/` resolves over HTTP but not on disk, so link `foo/index.html` explicitly.
- **`.github/` is infrastructure, not part of the daily build.** It survives every teardown. Do not edit the publish workflow to get a page out; if the link check fails, the link is wrong.

## How the code is expected to look

The pages are a showcase of the build as much as the idea, so the code is read as well as run.

- **Split the page into files that each do one thing:** `index.html` for markup, `styles.css`, a
  domain module holding the simulation, a renderer, and a thin entry point that wires them together.
  This is not decoration — it is what lets the domain module be imported and tested.
- **The domain module must not touch the DOM.** No canvas, no `document`, no globals. If the physics
  cannot be run headlessly, it cannot be proven.
- **Ship tests that attack the claims, not the plumbing.** Use the built-in runner (`node --test`,
  zero install). A good test fails when the science is wrong: the fitted law, the invariants, the
  published failures. Testing that a button toggles proves nothing worth proving.
- **The reader must be able to run them without leaving the page.** "Clone the repo" is a wall most
  visitors will not climb, and a test they cannot run is just another claim. Put the assertions in a
  module both `node --test` and the browser import, and give the page a button that runs them live
  and shows the evidence each one measured. One source of truth, executed twice — never a
  browser-only replica, which can drift from what CI actually checks.
- **A failing run has to look like one.** Prove the red path before shipping: break a threshold on
  purpose, confirm the page reports it, then restore from a copy taken beforehand.
- **Do not name a browser module `test-*.js`.** Node's test discovery matches that pattern and will
  execute it as a test file, where it dies on the first mention of `document`.
- **Set thresholds from measurement.** Run several seeds, take the worst observed value, add headroom,
  and say so in the file. Numbers tuned until one run passes are worthless.
- **When a test contradicts the page, the page is what changes.** That has already happened once and
  it produced a better result than the claim it killed. Say so on the page rather than quietly
  editing the sentence.
- **Type-check with `// @ts-check` and JSDoc**, verified by the editor against the repo `tsconfig.json`.
  No TypeScript build, because a build step would mean the code being read is not the code that runs.
- **SRP and dependency inversion are the parts of SOLID that apply here.** Do not invent inheritance
  hierarchies, factories, or injection containers to satisfy the other three. Over-abstraction in a
  400-line simulation is its own kind of slop.
- **One commit per day's build**, message naming the thesis. The journal entry and its screenshot go in that same commit.
