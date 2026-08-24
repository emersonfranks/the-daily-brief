# The daily brief

This repository holds one thing: a single-page interactive experience, rebuilt from scratch every 24 hours.

**What survives the teardown:** this file, `README.md`, `JOURNAL.md`, the `journal/` screenshots, `.github/`, `.gitignore`, `.nojekyll`, and git history.
**What gets blown away and rebuilt daily:** every `{model}/` build directory, the cards on the root `index.html`, and any assets they need.

**How you know a new day has started.** The landing page carries a date heading. If it does not say
today's date, yesterday's site is still standing and you are the first model building today, so you
clear it out. If it already says today's date, another model has built today — take nothing down and
add yourself alongside them. That heading is the one thing you may read on the landing page before
your own page is finished; the cards under it stay off limits until then. The exact procedure is in
step 5, and the rule that matters most is this: **the teardown removes yesterday, never your
neighbours.** If you cannot tell which you are looking at, delete nothing and ask.

**Where your page goes.** More than one model may build a page on the same day, so no model owns the
root. Build yours at `{model}/index.html`, where `{model}` is a lowercase, punctuation-free slug of
**the model's name — not the product or tool you are running inside**. You may well be instructed
elsewhere to introduce yourself as the product: GitHub Copilot, Copilot Chat, Cursor, or similar.
That is the harness, and every model here shares it. Use the name from the model picker instead:

| Model | Directory | Card and journal say |
|---|---|---|
| Claude Opus 5 | `claudeopus5/` | Claude Opus 5 |
| GPT-5.6 Sol | `gpt56sol/` | GPT-5.6 Sol |
| Gemini 3.7 Flash | `gemini37flash/` | Gemini 3.7 Flash |

Naming yourself after the harness would collide with every other model that ever builds here and
overwrite someone else's page, so the structure check rejects it. Never *replace* the root
`index.html`; that file is the landing page listing the day's builds, and you append your own card
to it, leaving every existing card intact.

**This is published, live, to the public internet.** The site is served by GitHub Pages at
<https://emersonfranks.github.io/the-daily-brief/>. **Build, commit, push — that is the whole
deploy.** The `Publish` workflow in `.github/workflows/` takes it from there and the page is live
within a minute or two; there is no manual step and nothing for you to configure. Before it
publishes, that workflow runs `.github/scripts/check-structure.mjs`, which checks the landing page
heading, the shape of every card, that each build is listed, and that every file your page loads was
actually committed; `.github/scripts/check-teardown.mjs`, which refuses any push that deletes a
build directory unless the date heading moved in the same push; and then `node --test`. If your card
is malformed, you forgot to commit a module, or you are about to delete a page that was published
today, the deploy fails loudly instead of doing it. You can run the same checks yourself with
`node .github/scripts/check-structure.mjs .`. Assume anything you write will be read by someone who
is not the person who asked for it.

**Work blind. Do not look at what has already been built.** Until your own page is finished, do not
open any other `{model}/` directory, do not read `JOURNAL.md`, do not read the existing cards on the
root `index.html`, and do not go mining `git log` for what previous days chose. Your pairing must be
arrived at without knowing what anyone else picked.

Once your page is finished, steps 5 and 6 send you to the landing page and the journal to append to
them, and you will unavoidably see what is there. That is expected, and it is the only reason to
open them. Two rules apply from that moment: **append**, never edit or reorder what already exists;
and do not change your own page in response to anything you have just read. If you find that someone
already built your pairing, **ship yours unchanged and say so in your journal entry** — two models
independently converging on the same hidden pattern is a genuinely interesting result, and steering
around it would cost more than the duplicate does.

Everything you need in order to match the house format is written out below, so you never have to
reverse-engineer it from someone else's build.

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

- **No build step, no server:** The page must run directly in a browser from static files — no bundler, no transpiler, no backend, no database. "Self-contained" means the deploy has no build, *not* that everything lives in one file: split the page into `index.html`, `styles.css` and ES modules, as described under *How the code is expected to look*. Because ES modules are fetched rather than inlined, test over HTTP — the live URL is the reference, and `file://` may refuse to load them.
- **Zero Friction:** Require zero sign-ups, zero setup, and zero instructions to start exploring. The interaction should feel immediate, responsive, and inviting. A reader arriving cold must be able to answer three questions without clicking anything: what am I looking at, what should I do, and what should I expect to happen.
- **Layered Discovery:**
  - *Surface Level:* An immediate, interactive visual experience or simulation that anyone can play with instantly — with the experiment named in plain words before the first control, so it never reads as an unexplained toy.
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
1. Everything must still run as plain static files with no build step.
2. Rely strictly on reliable, public CDNs (e.g., cdnjs, unpkg, or jsDelivr).
3. Always implement graceful fallbacks (e.g., if audio is blocked by the browser's autoplay policy, ensure the page functions silently until the user clicks).
4. Prioritize performance: Ensure animations run at a smooth frame rate and clean up animation loops/audio contexts on page reset.

---

## DAILY GENERATION WORKFLOW

1. **Pattern Discovery:** Identify two unrelated systems that share an underlying behavioral or structural pattern. Do this from your own knowledge, without reading anything else in this repository.
2. **Conceptual Framing:** Draft a single, compelling "plain-English thesis" that articulates the connection. Treat it as provisional — it is a hypothesis until step 4 measures it, and the wording is not final until then.
3. **Interactive Canvas:** Code a clean, performant, front-end interactive simulation or visual interface that demonstrates this shared pattern live. Make sure all four layers from *Layered Discovery* end up on the page: the interactive surface, the plain-English thesis, the expandable deep section, and the proof appendix from step 4.
4. **Measure, then Prove:** Run your simulation headlessly and check the thesis against what it actually produces. **If the measurement disagrees with your draft thesis, the thesis changes.** Then encode those checks so the reader can run them too. On top of the page modules described under *How the code is expected to look*, the test apparatus is three more files:
   - `claims.js` — every assertion as data: a name, what it catches, and a `verify()` that returns the evidence it measured or throws. No DOM, no `node:test`, so both sides can import it.
   - `<name>.test.js` — a thin file handing each claim to `node --test`. Node discovers `*.test.js` on its own. It must never mention `document`.
   - a browser module that imports the same `claims.js` and renders each result next to a button. Name it for what it does, such as `claims-panel.js` — anything but `test-*.js`, which Node would try to run as a test.

   Tests live in your own `{model}/` directory and are torn down with it, so you prove your own claims rather than inheriting anyone else's. `node --test` must pass before you push; CI runs it again and will not publish a build whose claims fail.
5. **Render & Deploy:** Output the complete, production-ready web code to `{model}/index.html`. Then run `git pull --rebase` before you decide anything, so you are reading what is actually published rather than a checkout that went stale while you were building. Now open the root `index.html` and read its date heading, which decides whether today is a fresh day:

   - **The heading does not say today's date.** The day has rolled over and you are the first build. Delete every `{model}/` build directory except the one you just created, delete every card on the landing page, and set the heading to today's date. Nothing is lost — git history holds every page and the journal holds their screenshots.
   - **The heading already says today's date.** One or more models have already built today. Delete nothing, change no existing card, and leave the heading alone.

   Either way, finish by appending your card to the end of the card list. Do not replace the file and do not touch other cards:

   ```html
   <a class="build" href="{model}/index.html">
     <div class="model">Your Model Name</div>
     <div class="buildtitle">Your Page Title</div>
     <div class="pairing"><b>system A</b> &harr; <b>system B</b></div>
     <div class="buildsub">One or two sentences, under about 45 words.</div>
   </a>
   ```

   The date heading keeps the format `<h2>21 August 2026 &middot; today's pairings</h2>`.
6. **Record It:** Capture a full-page screenshot of your finished page to `journal/YYYY-MM-DD-your-page-title.png`, then append an entry to the top of the entry list in `JOURNAL.md`, newest first:

   ```markdown
   ## YYYY-MM-DD — Your Page Title

   **Built by:** Your Model Name
   **Path:** `{model}/index.html`
   **Commit:** [`hash`](https://github.com/emersonfranks/the-daily-brief/commit/hash)
   **The pairing:** system A ↔ system B

   ![Descriptive alt text saying what the screenshot shows](journal/YYYY-MM-DD-your-page-title.png)

   **The thesis.** What the connection is, in plain English.
   **The interaction.** What the reader can do, and what it reveals.
   **What it measured.** The numbers, with the conditions they were measured under.
   **What failed.** Anything that did not reproduce, and what you concluded from it.
   **Stack:** libraries used, or "no libraries", and how the code is split.
   ```

   An entry cannot know its own commit hash, so write `pending` there, then replace it with the real
   hash in a small follow-up commit once the build is pushed. **Never write a hash you have not
   confirmed is published** — a hash taken from a commit you later amended or rebased still exists on
   your machine but 404s for every reader, and CI now rejects it.

---

## Standing conventions

These are settled decisions from previous days. They are not part of the original brief; they are how the brief gets carried out here.

- **Nothing gets installed on the machine.** No `npm install`, no bundler, no local tooling. Node is already present and its built-in test runner (`node --test`) pulls nothing down, which is exactly why the suite uses it. The toolbelt above is loaded at runtime from a CDN, which is not an install. Ask before adding anything to the machine itself.
- **Never contact npm or any package registry from the build machine.** It sits behind a corporate security control, and even a read-only version lookup against `registry.npmjs.org` trips an alert. A TLS failure reaching a registry is that control saying no — stop, do not retry, and do not route around it with a different tool. If a version number is genuinely needed, ask rather than probing. CI runners are a separate environment and are not covered by this, but prefer solutions that need no registry at all.
- **Pin exact library versions.** Never `@latest`, never an unversioned URL — a page that silently changes when an upstream publishes is not a page that was measured. Add `integrity` hashes when the CDN publishes them.
- **A library has to earn its place.** Reach for one when it buys real capability (3D, audio synthesis, tweening, force layout), not to avoid writing forty lines of canvas. Hand-rolled remains the default for simple 2D work.
- **The page must survive a dead CDN.** If a script fails to load, the core experience should still render and explain itself rather than showing a blank frame.
- **Measure the claim before writing the prose.** Load the page in a browser and run the simulation headlessly against the thesis. If the sim contradicts the claim, the claim is wrong — change the thesis, not the data.
- **Publish the failures.** When a famous result is tested and does not reproduce, say so in the deep section with the numbers. A page that reports what it actually measured is worth more than one that illustrates what it hoped to find.
- **A day-old simulation disagreeing with established science is evidence about the simulation.** Order the suspects honestly: your model first, your measurement second, your arithmetic third, and the century of work behind the published result last. Extraordinary claims require extraordinary evidence, and one page built in 24 hours on one machine is a demonstration, not a refutation. Name the artifact you actually found.
- **Say which question you tested.** "The law is broken" and "my lattice stops resolving the law below four sides" are wildly different claims. Headings, footers and test names must carry the smaller one unless the larger is genuinely earned — a strapline that contradicts the body is still a false claim, even when the body is careful.
- **Every number in the copy must be one that was measured on the shipped code.** Keep literature claims and simulation results verbally distinct when they disagree.
- **The journal is append-only.** Past entries are a record of what was actually built and are never rewritten to look better in hindsight. A page whose claims were corrected mid-build says so in its entry. A build that gets retracted keeps its entry too, moved to the `# Retracted` section at the end with the reason attached — the record loses its value the moment it starts dropping failures.
- **Screenshot the page while it is running, not at frame zero.** A capture of an unstarted simulation reads as broken. Drive it to a representative state first, and freeze it if the capture needs more than one step.
- **Journal screenshots are full-page**, not just the fold: the whole scroll, with accordions left collapsed. Freeze any animation before capturing so the image is composed rather than caught mid-frame.
- **Keep the screenshot's long edge under 8000 pixels.** A model cannot ingest an image larger than that, and a build has already died mid-run on a 1838 × 10862 capture: the page was finished, the screenshot killed it. If the full page is taller, capture it at a reduced device scale factor so the whole scroll still fits in one image rather than cropping it.
- **The site is served by GitHub Pages** from `main` at the repo root, so every path must work as a plain static file over HTTP. Keep links relative, and remember `.nojekyll` means files are served exactly as committed. Verify your page on the live URL after pushing, not only from `file://` — a directory link like `foo/` resolves over HTTP but not on disk, so link `foo/index.html` explicitly.
- **To test locally over HTTP, run `python -m http.server 8000` from the repo root** and open `http://localhost:8000/`. Python is already on the machine; do not reach for a package manager to get a static server. ES modules are fetched rather than inlined, so a browser may refuse to load them over `file://` — if your page looks dead on disk, serve it before assuming it is broken.
- **Commit every file your page loads.** The CI link check verifies the landing page and each build's own references, but the surest habit is to read `git status` before pushing and account for every untracked file. A page whose stylesheet or module never got committed deploys as a blank frame.
- **Stage your own paths by name. Never `git add -A` or `git add .`.** A blanket stage sweeps up whatever another model left in the tree and publishes it under your commit — pages then reach the site with no journal entry of their own, which has already happened. Stage your `{model}/` directory, your card, your screenshot and your journal entry, and nothing else.
- **Another model's uncommitted work is not yours to delete or to commit.** If a teardown would remove a directory that has uncommitted changes in it, leave that directory alone, finish publishing your own build, and note it in your journal entry. Do not abandon your own finished page over someone else's debris, and do not commit their files to tidy up.
- **Push straight to `main`.** No branches, no pull requests. One commit per day per model, containing your `{model}/` directory, your card on the root `index.html`, your `journal/` screenshot and your `JOURNAL.md` entry, with a message naming the thesis. If another model pushed while you were building and your push is rejected, `git pull --rebase` and re-apply your card and journal entry underneath theirs — never drop or reorder what they added.
- **`.github/` is infrastructure, not part of the daily build.** It survives every teardown. Do not edit the publish workflow to get a page out; if the link check fails, the link is wrong.
- **Deleting is the one irreversible-looking act here, so gate it on the date and nothing else.** A build directory is only ever removed because its day is over, never because it looks stale, duplicated, broken or wrong. If another model's page is on the site under today's date, it stays, whatever you think of it. Pulling a published build early is a **retraction**, it is the operator's call and not yours, and it takes a commit message line reading `Retract: <slug> - reason`. Never retract another model's build.
- **Every module in a build carries `// @ts-check`**, tests included, and CI rejects the build if one does not. There is no build step; the pragma plus JSDoc is the whole type story.
- **Decide the teardown against the published state, never a stale checkout.** `git pull --rebase` immediately before you read the date heading. If your push is rejected because someone published while you were working, pull and then read the heading again: if today's date is now there, another model got in first and your teardown was wrong. Restore what you removed with `git checkout origin/main -- <their-directory>`, put their card back on the landing page, and push only your own work. A rebase will cheerfully replay a deletion onto work that did not exist when you decided to delete, which is why CI refuses any push that removes a build directory without the date heading changing in the same push.

## Making the science legible

A page can be measured, tested and entirely correct, and still fail — if a reader cannot tell what
they are looking at, what to do with it, or where the idea came from. These came out of a build that
measured cleanly and still left a first-time reader asking "why should I care, and for all I know
you made this up?"

- **Name the experiment before you show the controls.** Say in one line what to do and what to watch
  for: "drag the slider down until the grid flips, then bring it back to exactly where it started —
  it will not return." Controls that merely exist are a toy, not an interaction.
- **Say what one unit represents, on both sides of the pairing.** If a tile, dot or cell stands for
  something, name what it stands for in each domain. If two panels look identical, say why they are
  identical — that is usually the entire point, and it is invisible to someone who just arrived.
- **Every control earns a sentence.** A button labelled `TRIGGER LOCAL SHOCK` says what it does
  mechanically and nothing about why a reader would press it, or what a meaningful result looks
  like when they do.
- **Name the science out loud.** State which phenomenon, model or law the page rests on and who
  established it. However good the simulation is, a page with no named foundation reads as
  invention.
- **Cite where you can; never invent a citation.** Links and DOIs are welcome and are not mandatory.
  A fabricated reference is far worse than none — if you are not certain a paper exists and says
  what you are claiming, name the result and the researchers in prose and leave the link out.
- **Say whether the analogy is mathematical or empirical.** "Both systems are described by the same
  equation" and "both systems have been measured behaving the same way" are very different claims. A
  stylised analogy is legitimate and interesting; presenting one as the other is not. If your pairing
  is one field's model reinterpreted onto another domain, say so on the page rather than letting the
  visual imply more than you tested.

## Hypothesis, not advocacy

The failure this repository is most exposed to is not laziness. It is motivated reasoning: forming a
claim and then going looking for the data that supports it. Gathering evidence *for* a conclusion you
have already reached, and making a claim and then reporting what the evidence actually says, are
different procedures — and the first one produces confident, well-presented, false pages. Science is
built on the second and in permanent tension with the first. Only the second is what this repository
is for.

These rules exist because sincerity is not protection; a model that fully believes its thesis will
fabricate in its service. Follow them mechanically rather than by intention.

- **Write the prediction down before you measure it**, together with the result that would prove it
  wrong. If no plausible outcome could have falsified your thesis, you did not run an experiment —
  you built an illustration, and the page should say so.
- **Report the run you actually did.** If you ran five seeds, do not publish the prettiest. Publish
  the worst, or publish all of them and say which is which. Dropping a seed because it disagreed is
  the entire disease in a single move.
- **Post-hoc choices have to be visible.** Narrowing a fit to the range where it behaves is
  legitimate and often correct; doing it without also showing the wider range, and saying plainly
  why you narrowed it, is not.
- **Never write a number you did not measure.** No placeholder that looks about right, no value
  recalled from the literature and presented as a result, no rounding in the direction of the claim.
  Prefer rendering figures from the live run, so the reader watches them being produced instead of
  reading what you typed. Where a number must be hard-coded, state the conditions it came from.
- **Never cite a source you have not confirmed exists and says what you say it says.** A
  plausible-looking DOI is the easiest thing here to manufacture and the most damaging thing on the
  page — it converts an honest mistake into a fake credential. If you cannot confirm it, name the
  result and the researchers in prose and leave the link out.
- **Say on the page what would have changed your mind.** A thesis with no stated failure condition
  is advertising.
- **When the measurement kills the thesis, publish the corpse.** Change the claim, and say that you
  changed it and why. Every correction of this kind so far has produced a better page than the claim
  it replaced, which is the point.

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
- **Do not name a browser module `test-*.js`.** Node's test discovery matches that pattern and would
  execute your browser code as a test, where it dies on the first mention of `document`. Name test
  files `<name>.test.js` and keep them free of any DOM reference; put the browser-side runner in a
  module named something else.
- **Set thresholds from measurement.** Run several seeds, take the worst observed value, add headroom,
  and say so in the file. Numbers tuned until one run passes are worthless.
- **When a test contradicts the page, the page is what changes.** That has already happened once and
  it produced a better result than the claim it killed. Say so on the page rather than quietly
  editing the sentence.
- **Type-check with `// @ts-check` and JSDoc**, verified by the editor against the repo `tsconfig.json`.
  That file already exists at the repo root, survives every teardown and covers `*/*.js`, so use it
  rather than adding one of your own. No TypeScript build, because a build step would mean the code
  being read is not the code that runs.
- **SRP and dependency inversion are the parts of SOLID that apply here.** Do not invent inheritance
  hierarchies, factories, or injection containers to satisfy the other three. Over-abstraction in a
  400-line simulation is its own kind of slop.
- **One commit per day's build**, message naming the thesis. The journal entry and its screenshot go in that same commit.
