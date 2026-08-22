// @ts-check

import {
  DEFAULT_RIG,
  analyticHarm,
  braessWindow,
  createRigState,
  createRoadState,
  meanTravelTime,
  relaxRig,
  relaxRoads,
} from './braess-model.js';
import { drawDescent, drawHarmCurve } from './charts.js';
import { DOTS_PER_PANEL, drawRig, drawRoads } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const MAX_DRIVERS = 12000;

/** @param {string} id @returns {HTMLElement} */
function need(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}

const roadCanvas = /** @type {HTMLCanvasElement} */ (need('road-canvas'));
const rigCanvas = /** @type {HTMLCanvasElement} */ (need('rig-canvas'));
const descentCanvas = /** @type {HTMLCanvasElement} */ (need('descent-canvas'));
const harmCanvas = /** @type {HTMLCanvasElement} */ (need('harm-canvas'));
const linkToggle = /** @type {HTMLButtonElement} */ (need('link-toggle'));
const driverSlider = /** @type {HTMLInputElement} */ (need('drivers'));
const safetySlider = /** @type {HTMLInputElement} */ (need('safety'));

const state = {
  linkPresent: true,
  drivers: 4000,
  safetyLength: DEFAULT_RIG.safetyLength,
};

/** Rig geometry in both configurations, recomputed only when a parameter moves. */
let rig = { shown: createRigState(true), ghostDepth: 0 };

function resolveRig() {
  const params = { ...DEFAULT_RIG, safetyLength: state.safetyLength };
  const shown = createRigState(state.linkPresent, params);
  const other = createRigState(!state.linkPresent, params);
  relaxRig(shown);
  relaxRig(other);
  rig = { shown, ghostDepth: other.weight };
}

/** @returns {import('./braess-model.js').RoadState} */
function settledRoads() {
  const roads = createRoadState(state.drivers, state.linkPresent);
  relaxRoads(roads);
  return roads;
}

let roads = settledRoads();

function refresh() {
  roads = settledRoads();
  resolveRig();

  const commute = meanTravelTime(roads);
  const harm = analyticHarm(state.drivers);

  need('readout-commute').textContent = `${commute.toFixed(1)} min`;
  need('readout-depth').textContent = `${rig.shown.weight.toFixed(1)} cm`;
  need('readout-drivers').textContent = state.drivers.toLocaleString('en-GB');
  need('readout-safety').textContent = `${state.safetyLength.toFixed(0)} cm`;
  need('dot-scale').textContent = Math.round(state.drivers / DOTS_PER_PANEL).toLocaleString('en-GB');

  const verdictRoad = need('verdict-road');
  const verdictRig = need('verdict-rig');
  if (harm > 0.05) {
    verdictRoad.textContent = state.linkPresent
      ? `Shutting the shortcut would cut ${harm.toFixed(1)} min off every commute.`
      : `Reopening the shortcut would add ${harm.toFixed(1)} min back onto every commute.`;
    verdictRoad.className = 'verdict-line bad';
  } else if (harm < -0.05) {
    verdictRoad.textContent = `At this demand the shortcut genuinely helps, by ${(-harm).toFixed(1)} min. No paradox here.`;
    verdictRoad.className = 'verdict-line good';
  } else {
    verdictRoad.textContent = 'At this demand the shortcut makes no difference either way.';
    verdictRoad.className = 'verdict-line';
  }

  const rise = state.linkPresent ? rig.shown.weight - rig.ghostDepth : rig.ghostDepth - rig.shown.weight;
  if (rise > 0.05) {
    verdictRig.textContent = state.linkPresent
      ? `Cutting the link would lift the weight ${rise.toFixed(1)} cm.`
      : `Retying the link would drop the weight ${rise.toFixed(1)} cm again.`;
    verdictRig.className = 'verdict-line bad';
  } else if (rise < -0.05) {
    verdictRig.textContent = `With side cables this long, cutting drops the weight ${(-rise).toFixed(1)} cm. No paradox here.`;
    verdictRig.className = 'verdict-line good';
  } else {
    verdictRig.textContent = 'The side cables are short enough to carry the load already: cutting changes nothing.';
    verdictRig.className = 'verdict-line';
  }

  linkToggle.textContent = state.linkPresent ? 'Remove both links' : 'Put both links back';
  linkToggle.setAttribute('aria-pressed', String(!state.linkPresent));
  need('link-state').textContent = state.linkPresent
    ? 'Shortcut open, string intact'
    : 'Shortcut closed, string cut';

  drawDescent(descentCanvas, state.drivers);
  drawHarmCurve(harmCanvas, state.drivers, MAX_DRIVERS);
}

let frame = 0;
let clock = 0;
let last = performance.now();

/** @param {number} now */
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  drawRoads(roadCanvas, roads, clock);
  drawRig(rigCanvas, rig.shown, rig.ghostDepth);
  frame = window.requestAnimationFrame(tick);
}

linkToggle.addEventListener('click', () => {
  state.linkPresent = !state.linkPresent;
  refresh();
});

driverSlider.addEventListener('input', () => {
  state.drivers = Number(driverSlider.value);
  refresh();
});

safetySlider.addEventListener('input', () => {
  state.safetyLength = Number(safetySlider.value);
  refresh();
});

window.addEventListener('resize', () => {
  drawDescent(descentCanvas, state.drivers);
  drawHarmCurve(harmCanvas, state.drivers, MAX_DRIVERS);
});

window.addEventListener('pagehide', () => window.cancelAnimationFrame(frame));

const window_ = braessWindow();
need('window-lower').textContent = window_.lower.toLocaleString('en-GB');
need('window-upper').textContent = window_.upper.toLocaleString('en-GB');
need('window-peak').textContent = `${window_.peakHarm.toFixed(1)} min at ${window_.peakDrivers.toLocaleString('en-GB')} drivers`;

mountClaimsPanel(
  need('claims-list'),
  /** @type {HTMLButtonElement} */ (need('run-claims')),
  need('claims-verdict'),
);

refresh();
frame = window.requestAnimationFrame(tick);
