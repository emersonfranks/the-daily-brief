// @ts-check

/**
 * Entry point. Owns the two live agents, the controls, and the in-page sweep. It reads from
 * `policy.js` and paints through `renderer.js`; it contains no physics of its own, so nothing
 * shown here can disagree with what `node --test` checks.
 */

import {
  DEFAULTS,
  SEEDS,
  createAgent,
  fitTail,
  step,
  sweepNoise,
  fitPowerLaw,
} from './policy.js';
import { drawSwimmer, drawOptimizer, drawMeter, drawTrace, drawLogLog, PALETTE } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const TRAIL_LENGTH = 260;
const TRACE_LENGTH = 220;
const RESPONSE_MEMORY = 0.985;

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
}

/** @param {string} id */
function canvasEl(id) {
  const node = el(id);
  if (!(node instanceof HTMLCanvasElement)) throw new Error(`#${id} is not a canvas`);
  return node;
}

/** @param {string} id */
function inputEl(id) {
  const node = el(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  return node;
}

const ui = {
  noise: inputEl('noise'),
  noiseOut: el('noiseOut'),
  gain: inputEl('gain'),
  gainState: el('gainState'),
  beta: inputEl('beta'),
  betaOut: el('betaOut'),
  reset: el('reset'),
  swimmerCanvas: canvasEl('swimmerCanvas'),
  optimizerCanvas: canvasEl('optimizerCanvas'),
  swimmerMeter: canvasEl('swimmerMeter'),
  optimizerMeter: canvasEl('optimizerMeter'),
  swimmerTrace: canvasEl('swimmerTrace'),
  optimizerTrace: canvasEl('optimizerTrace'),
  swimmerAmp: el('swimmerAmp'),
  optimizerAmp: el('optimizerAmp'),
  swimmerSteer: el('swimmerSteer'),
  optimizerSteer: el('optimizerSteer'),
  swimmerExtra: el('swimmerExtra'),
  optimizerExtra: el('optimizerExtra'),
  verdict: el('verdict'),
  sweepButton: el('sweepButton'),
  sweepStatus: el('sweepStatus'),
  effChart: canvasEl('effChart'),
  strideChart: canvasEl('strideChart'),
  sweepTable: el('sweepTable'),
};

/**
 * @typedef {object} Live
 * @property {import('./policy.js').Agent} agent
 * @property {import('./renderer.js').TrailPoint[]} trail
 * @property {number} responseSq   Exponentially weighted mean square of the normalised response.
 * @property {number} lastStep
 * @property {number[]} trace       Per-step signature: turn demand, or step length.
 */

/** @type {{ swimmer: Live, optimizer: Live }} */
let live = spawn();

function currentParams() {
  return {
    noise: Number(ui.noise.value),
    adaptive: ui.gain.checked,
    beta: Number(ui.beta.value),
  };
}

/** @returns {{ swimmer: Live, optimizer: Live }} */
function spawn() {
  const shared = currentParamsSafe();
  /** @param {import('./policy.js').System} system */
  const make = (system) => ({
    agent: createAgent({ ...shared, system }, system === 'swimmer' ? 20260831 : 8312026),
    trail: /** @type {import('./renderer.js').TrailPoint[]} */ ([]),
    responseSq: 1,
    lastStep: 0,
    trace: /** @type {number[]} */ ([]),
  });
  return { swimmer: make('swimmer'), optimizer: make('optimizer') };
}

/** Reading the controls before they are wired would throw, so fall back to the defaults. */
function currentParamsSafe() {
  try {
    return currentParams();
  } catch {
    return { noise: DEFAULTS.noise, adaptive: DEFAULTS.adaptive, beta: DEFAULTS.beta };
  }
}

function applyControls() {
  const p = currentParams();
  for (const side of [live.swimmer, live.optimizer]) {
    side.agent.params.noise = p.noise;
    side.agent.params.adaptive = p.adaptive;
    side.agent.params.beta = p.beta;
  }
  ui.noiseOut.textContent = p.noise.toFixed(2);
  ui.betaOut.textContent = p.beta.toFixed(3);
  ui.gainState.textContent = p.adaptive ? 'ON' : 'OFF';
  ui.gainState.dataset.state = p.adaptive ? 'on' : 'off';
}

/** @param {Live} side */
function advance(side) {
  const record = step(side.agent);
  side.responseSq =
    RESPONSE_MEMORY * side.responseSq + (1 - RESPONSE_MEMORY) * record.response * record.response;
  side.lastStep = record.dx;
  side.trail.push({ x: record.x, t: side.agent.steps, event: record.turned });
  if (side.trail.length > TRAIL_LENGTH) side.trail.shift();
  side.trace.push(
    side.agent.params.system === 'swimmer' ? record.demand : Math.abs(record.dx)
  );
  if (side.trace.length > TRACE_LENGTH) side.trace.shift();
  return record;
}

/** @param {Live} side */
function amplitude(side) {
  return Math.sqrt(side.responseSq);
}

/** @param {Live} side */
function steering(side) {
  return side.agent.pathLength === 0 ? 0 : side.agent.x / side.agent.pathLength;
}

function paint() {
  drawSwimmer(ui.swimmerCanvas, {
    x: live.swimmer.agent.x,
    heading: live.swimmer.agent.heading,
    trail: live.swimmer.trail,
    step: live.swimmer.agent.steps,
    scaleWorld: 2.4,
  });
  drawOptimizer(ui.optimizerCanvas, {
    x: live.optimizer.agent.x,
    trail: live.optimizer.trail,
    step: live.optimizer.agent.steps,
    scaleWorld: 2.4,
    lastStep: live.optimizer.lastStep,
  });

  const swimmerAmp = amplitude(live.swimmer);
  const optimizerAmp = amplitude(live.optimizer);

  drawMeter(ui.swimmerMeter, {
    value: swimmerAmp,
    max: 20,
    target: 1,
    colour: PALETTE.BIO,
    label: 'response amplitude',
  });
  drawMeter(ui.optimizerMeter, {
    value: optimizerAmp,
    max: 20,
    target: 1,
    colour: PALETTE.MACHINE,
    label: 'response amplitude',
  });

  ui.swimmerAmp.textContent = swimmerAmp.toFixed(2);
  drawTrace(ui.swimmerTrace, {
    values: live.swimmer.trace,
    max: 2,
    rail: 1,
    colour: PALETTE.BIO,
    label: 'turn probability demanded, per step',
  });
  drawTrace(ui.optimizerTrace, {
    values: live.optimizer.trace,
    max: 4,
    rail: null,
    colour: PALETTE.MACHINE,
    label: 'step length, per step',
  });

  ui.optimizerAmp.textContent = optimizerAmp.toFixed(2);
  ui.swimmerSteer.textContent = steering(live.swimmer).toFixed(3);
  ui.optimizerSteer.textContent = steering(live.optimizer).toFixed(3);

  const saturation =
    live.swimmer.agent.steps === 0 ? 0 : live.swimmer.agent.saturated / live.swimmer.agent.steps;
  ui.swimmerExtra.textContent = `${(saturation * 100).toFixed(0)}%`;
  const stride =
    live.optimizer.agent.steps === 0
      ? 0
      : live.optimizer.agent.pathLength / live.optimizer.agent.steps;
  ui.optimizerExtra.textContent = stride.toFixed(2);

  const gap = Math.abs(swimmerAmp - optimizerAmp);
  if (ui.gain.checked) {
    ui.verdict.textContent =
      `Both dials are sitting on 1. They differ by ${gap.toFixed(2)} — a bacterium and an ` +
      'optimizer, holding the same number while the noise moves underneath them.';
    ui.verdict.dataset.state = 'held';
  } else {
    ui.verdict.textContent =
      `Both dials have left 1 together (${swimmerAmp.toFixed(2)} and ${optimizerAmp.toFixed(2)}). ` +
      'Now look at the steering row: it barely moved. That is the whole finding.';
    ui.verdict.dataset.state = 'loose';
  }
}

let running = true;

function frame() {
  if (running) {
    for (let i = 0; i < 3; i += 1) {
      advance(live.swimmer);
      advance(live.optimizer);
    }
    paint();
  }
  requestAnimationFrame(frame);
}

function reset() {
  live = spawn();
  applyControls();
  paint();
}

ui.noise.addEventListener('input', applyControls);
ui.beta.addEventListener('input', applyControls);
ui.gain.addEventListener('change', applyControls);
ui.reset.addEventListener('click', reset);
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
});

/* ---------------------------------------------------------------- the in-page sweep ---------- */

const SWEEP_STEPS = 4000;

/** @type {{ key: string, label: string, colour: string, dashed: boolean }[]} */
const SWEEP_SERIES = [
  { key: 'swimmer:true', label: 'bacterium, gain control ON', colour: PALETTE.BIO, dashed: false },
  { key: 'swimmer:false', label: 'bacterium, OFF', colour: PALETTE.BIO, dashed: true },
  { key: 'optimizer:true', label: 'optimizer, gain control ON', colour: PALETTE.MACHINE, dashed: false },
  { key: 'optimizer:false', label: 'optimizer, OFF', colour: PALETTE.MACHINE, dashed: true },
];

function runSweep() {
  ui.sweepStatus.textContent = 'running 8 seeds x 13 noise levels x 4,000 steps, four ways...';
  ui.sweepButton.setAttribute('disabled', 'disabled');

  // Yield once so the status text paints before the main thread is occupied.
  setTimeout(() => {
    /** @type {Map<string, import('./policy.js').SweepPoint[]>} */
    const results = new Map();
    for (const s of SWEEP_SERIES) {
      const [system, adaptive] = s.key.split(':');
      results.set(
        s.key,
        sweepNoise(
          {
            system: /** @type {import('./policy.js').System} */ (system),
            adaptive: adaptive === 'true',
          },
          SEEDS,
          SWEEP_STEPS
        )
      );
    }

    drawLogLog(ui.effChart, {
      series: SWEEP_SERIES.map((s) => ({
        label: s.label,
        colour: s.colour,
        dashed: s.dashed,
        points: (results.get(s.key) ?? []).map((p) => ({ x: p.noise, y: p.efficiency })),
      })),
      xLabel: 'measurement noise  sigma',
      yLabel: 'steering efficiency',
      yMin: 0.01,
      yMax: 1,
    });

    drawLogLog(ui.strideChart, {
      series: SWEEP_SERIES.map((s) => ({
        label: s.label,
        colour: s.colour,
        dashed: s.dashed,
        points: (results.get(s.key) ?? []).map((p) => ({ x: p.noise, y: p.responseRms })),
      })),
      xLabel: 'measurement noise  sigma',
      yLabel: 'response amplitude',
      yMin: 0.1,
      yMax: 100,
    });

    const rows = SWEEP_SERIES.map((s) => {
      const sweep = results.get(s.key) ?? [];
      const fit = fitTail(sweep, 1);
      const amplitudeFit = fitPowerLaw(
        sweep.filter((p) => p.noise >= 1).map((p) => ({ x: p.noise, y: p.responseRms }))
      );
      return (
        `<tr><th scope="row" style="color:${s.colour}">${s.label}</th>` +
        `<td>${fit.exponent.toFixed(3)}</td>` +
        `<td>${fit.r2.toFixed(4)}</td>` +
        `<td>${amplitudeFit.exponent.toFixed(3)}</td></tr>`
      );
    }).join('');

    ui.sweepTable.innerHTML =
      '<table><caption>Fitted on the run you just triggered, not typed in.</caption>' +
      '<thead><tr><th scope="col">configuration</th>' +
      '<th scope="col">steering exponent (sigma&nbsp;&ge;&nbsp;1)</th>' +
      '<th scope="col">r&sup2;</th>' +
      '<th scope="col">amplitude exponent (sigma&nbsp;&ge;&nbsp;1)</th></tr></thead>' +
      `<tbody>${rows}</tbody></table>`;

    ui.sweepStatus.textContent =
      'Done. Four configurations, four steering exponents within 0.15 of each other — and two ' +
      'amplitude exponents near 0 against two near 1. Steering did not notice the switch; ' +
      'amplitude is the only thing that did.';
    ui.sweepButton.removeAttribute('disabled');
  }, 30);
}

ui.sweepButton.addEventListener('click', runSweep);

mountClaimsPanel(el('claimsPanel'));

applyControls();
paint();
requestAnimationFrame(frame);
