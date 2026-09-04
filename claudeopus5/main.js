// @ts-check

/**
 * Entry point. Owns the DOM, owns nothing else: the physics is in `hysterons.js`, the units are in
 * `observables.js`, the pixels are in `renderer.js` and the claims are in `claims.js`.
 */

import {
  createEnsemble, sweepTo, saturateDown, snapshot, mismatch, limitCyclePeriod,
} from './hysterons.js';
import { pressureFromDrive, fieldFromDrive, flowRate, magnetisation, DRIVE_MIN, DRIVE_MAX } from './observables.js';
import { drawChip, drawMagnet, drawPlot, throttledFraction } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

/** @param {string} id @returns {HTMLElement} */
function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found;
}

/** @param {string} id @returns {HTMLCanvasElement} */
function canvas(id) {
  const found = element(id);
  if (!(found instanceof HTMLCanvasElement)) throw new Error(`#${id} is not a canvas`);
  return found;
}

const chipCanvas = canvas('chip');
const magnetCanvas = canvas('magnet');
const flowPlotCanvas = canvas('flow-plot');
const magnetisationPlotCanvas = canvas('magnetisation-plot');

const driveInput = /** @type {HTMLInputElement} */ (element('drive'));
const kindSelect = /** @type {HTMLSelectElement} */ (element('coupling-kind'));
const strengthInput = /** @type {HTMLInputElement} */ (element('coupling-strength'));
const strengthValue = element('coupling-strength-value');
const sizeSelect = /** @type {HTMLSelectElement} */ (element('size'));
const verdict = element('verdict');

/**
 * @typedef {Object} Bench
 * @property {import('./hysterons.js').Ensemble} ensemble
 * @property {{ x: number, y: number }[]} flowTrace
 * @property {{ x: number, y: number }[]} magnetisationTrace
 * @property {Map<number, number>} flashes  switch index to the timestamp it flipped
 * @property {number} lastAvalanche
 * @property {{ flow: { x: number, y: number }, magnetisation: { x: number, y: number } } | null} turningPoint
 * @property {number[] | null} script       remaining drive targets of a scripted experiment
 * @property {Uint8Array | null} scriptMark state captured at the scripted turning point
 * @property {number} seed
 */

/** @type {Bench} */
const bench = {
  ensemble: createEnsemble({ n: 64, seed: 1, kind: 'none', couplingStrength: 0 }),
  flowTrace: [],
  magnetisationTrace: [],
  flashes: new Map(),
  lastAvalanche: 0,
  turningPoint: null,
  script: null,
  scriptMark: null,
  seed: 1,
};

let soundOn = false;
/** @type {AudioContext | null} */
let audio = null;
let lastClickAt = 0;

/** Play one short click per switch flip, rate-limited so an avalanche crackles instead of roaring. */
function crackle(flips) {
  if (!soundOn || flips <= 0) return;
  if (!audio) {
    const Ctor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!Ctor) return;
    audio = new Ctor();
  }
  const now = audio.currentTime;
  if (now - lastClickAt < 0.012) return;
  lastClickAt = now;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 900 + Math.min(flips, 20) * 90;
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.03);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.035);
}

/** @returns {import('./hysterons.js').CouplingKind} */
function currentKind() {
  const value = kindSelect.value;
  if (value === 'ferro' || value === 'frustrated' || value === 'asymmetric') return value;
  return 'none';
}

function recordTrace() {
  const { ensemble } = bench;
  bench.flowTrace.push({ x: pressureFromDrive(ensemble.drive), y: flowRate(ensemble.state, ensemble.drive) });
  bench.magnetisationTrace.push({ x: fieldFromDrive(ensemble.drive), y: magnetisation(ensemble.state) });
  if (bench.flowTrace.length > 4000) {
    bench.flowTrace.shift();
    bench.magnetisationTrace.shift();
  }
}

/**
 * Move the drive and remember what happened, including which switches flipped so they can flash.
 * @param {number} target
 */
function driveTo(target) {
  const before = snapshot(bench.ensemble);
  const { flips, maxAvalanche } = sweepTo(bench.ensemble, target, 0.005);
  const totalFlips = flips.reduce((sum, f) => sum + f, 0);
  if (totalFlips > 0) {
    const now = performance.now();
    for (let i = 0; i < bench.ensemble.n; i += 1) {
      if (before[i] !== bench.ensemble.state[i]) bench.flashes.set(i, now);
    }
    bench.lastAvalanche = maxAvalanche;
    crackle(totalFlips);
  }
  recordTrace();
}

function rebuild() {
  const n = Number(sizeSelect.value);
  const strength = Number(strengthInput.value);
  bench.ensemble = createEnsemble({ n, seed: bench.seed, kind: currentKind(), couplingStrength: strength });
  saturateDown(bench.ensemble);
  bench.flowTrace = [];
  bench.magnetisationTrace = [];
  bench.flashes.clear();
  bench.lastAvalanche = 0;
  bench.turningPoint = null;
  bench.script = null;
  bench.scriptMark = null;
  driveInput.value = String(DRIVE_MIN);
  recordTrace();
}

/** @param {string} text @param {'' | 'good' | 'broken'} tone */
function say(text, tone = '') {
  verdict.innerHTML = text;
  verdict.className = `verdict ${tone}`.trim();
}

// --- the scripted memory experiment -------------------------------------------------------------
// Saturate, climb to a turning point, mark the state there, take a detour downward, climb back to
// exactly the same drive, and count how many switches disagree with the mark.

const TURNING_POINT = 0.45;
const DETOUR_BOTTOM = -0.5;

function startMemoryExperiment() {
  rebuild();
  bench.script = [TURNING_POINT, DETOUR_BOTTOM, TURNING_POINT];
  bench.scriptMark = null;
  say('Climbing to the turning point&hellip;');
}

function advanceScript() {
  if (!bench.script || bench.script.length === 0) return;
  const target = bench.script[0];
  const rate = 0.014;
  const drive = bench.ensemble.drive;
  const next = target > drive ? Math.min(target, drive + rate) : Math.max(target, drive - rate);
  driveTo(next);

  if (Math.abs(bench.ensemble.drive - target) > 1e-9) return;
  bench.script.shift();

  if (bench.script.length === 2) {
    bench.scriptMark = snapshot(bench.ensemble);
    bench.turningPoint = {
      flow: { x: pressureFromDrive(bench.ensemble.drive), y: flowRate(bench.ensemble.state, bench.ensemble.drive) },
      magnetisation: { x: fieldFromDrive(bench.ensemble.drive), y: magnetisation(bench.ensemble.state) },
    };
    say('Turning point marked. Now taking a detour down and coming back to exactly this drive&hellip;');
  } else if (bench.script.length === 0) {
    const wrong = bench.scriptMark ? mismatch(bench.scriptMark, bench.ensemble.state) : -1;
    const n = bench.ensemble.n;
    bench.script = null;
    if (wrong === 0) {
      say(`Back at the same drive after the detour: <b>${n} of ${n} switches</b> are exactly where they were, and both instruments read exactly what they read before. The detour left no trace.`, 'good');
    } else {
      say(`Back at the same drive after the detour: <b>${wrong} of ${n} switches</b> came back wrong. The interaction you selected has destroyed return point memory — this is the boundary, not a bug.`, 'broken');
    }
  }
}

// --- animation ----------------------------------------------------------------------------------

let startedAt = performance.now();

function frame() {
  const now = performance.now();
  const phase = (now - startedAt) / 1000;

  if (bench.script) advanceScript();

  for (const [index, at] of bench.flashes) {
    if (now - at > 220) bench.flashes.delete(index);
  }
  const flashing = new Set(bench.flashes.keys());

  drawChip(chipCanvas, bench.ensemble, phase, flashing);
  drawMagnet(magnetCanvas, bench.ensemble, flashing);

  const flowNow = { x: pressureFromDrive(bench.ensemble.drive), y: flowRate(bench.ensemble.state, bench.ensemble.drive) };
  const magnetisationNow = { x: fieldFromDrive(bench.ensemble.drive), y: magnetisation(bench.ensemble.state) };

  drawPlot(flowPlotCanvas, {
    trace: bench.flowTrace,
    xRange: [0, 12],
    yRange: [0, 12],
    xLabel: 'applied pressure (kPa)',
    yLabel: 'flow (uL/s)',
    marker: flowNow,
    turningPoint: bench.turningPoint ? bench.turningPoint.flow : null,
    colour: '#5fd4ff',
  });
  drawPlot(magnetisationPlotCanvas, {
    trace: bench.magnetisationTrace,
    xRange: [fieldFromDrive(DRIVE_MIN), fieldFromDrive(DRIVE_MAX)],
    yRange: [-1, 1],
    xLabel: 'applied field (mT)',
    yLabel: 'magnetisation',
    marker: magnetisationNow,
    turningPoint: bench.turningPoint ? bench.turningPoint.magnetisation : null,
    colour: '#ffb347',
  });

  element('pressure').textContent = flowNow.x.toFixed(1);
  element('flow').textContent = flowNow.y.toFixed(2);
  element('throttled').textContent = `${Math.round(throttledFraction(bench.ensemble.state) * bench.ensemble.n)} of ${bench.ensemble.n}`;
  element('field').textContent = magnetisationNow.x.toFixed(1);
  element('magnetisation').textContent = magnetisationNow.y.toFixed(3);
  element('avalanche').textContent = String(bench.lastAvalanche);

  // Keep the slider showing where the drive actually is, including during scripted runs. While the
  // reader is dragging, this writes back the value they just chose, so it is a no-op.
  driveInput.value = String(bench.ensemble.drive);

  requestAnimationFrame(frame);
}

// --- wiring -------------------------------------------------------------------------------------

driveInput.addEventListener('input', () => {
  bench.script = null;
  driveTo(Number(driveInput.value));
});

for (const control of [kindSelect, strengthInput, sizeSelect]) {
  control.addEventListener('input', () => {
    strengthValue.textContent = Number(strengthInput.value).toFixed(2);
    rebuild();
    say('Rebuilt with new settings, saturated and ready. Drag the drive, or run the memory experiment.');
  });
}

element('run-memory').addEventListener('click', startMemoryExperiment);

element('run-cycles').addEventListener('click', () => {
  bench.script = null;
  const probe = createEnsemble({
    n: Number(sizeSelect.value),
    seed: bench.seed,
    kind: currentKind(),
    couplingStrength: Number(strengthInput.value),
  });
  const { period } = limitCyclePeriod(probe, -0.6, 0.6, 16, 0.01);
  if (period === 1) {
    say('Sixteen identical cycles: the system repeated itself every single time — <b>period 1</b>. This is what nearly every setting does. Try 6 switches, one-way coupling and strength above 1.5, then press <i>New random sample</i> a few times.');
  } else if (period === 0) {
    say('Sixteen identical cycles and the state never repeated once. That is a period longer than sixteen, or no limit cycle at all in this window.', 'broken');
  } else {
    say(`Sixteen identical cycles: this sample needed <b>${period} passes</b> through exactly the same drive history before it repeated itself. Same input, different output, with nothing random anywhere in the model — subharmonic response.`, 'broken');
  }
});

element('new-sample').addEventListener('click', () => {
  bench.seed = 1 + Math.floor(Math.random() * 100000);
  rebuild();
  say(`New random sample (seed ${bench.seed}): fresh thresholds, same physics.`);
});

element('reset').addEventListener('click', () => {
  rebuild();
  say('Saturated: the drive has been taken below every threshold, which is the only history-free state there is.');
});

const soundButton = element('sound');
soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.textContent = `Barkhausen clicks: ${soundOn ? 'on' : 'off'}`;
  soundButton.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) crackle(1);
});

window.addEventListener('resize', () => { startedAt = performance.now(); });

strengthValue.textContent = Number(strengthInput.value).toFixed(2);
rebuild();
mountClaimsPanel(element('run-claims'), element('claims-output'));
requestAnimationFrame(frame);
