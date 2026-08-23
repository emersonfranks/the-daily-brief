// @ts-check

/**
 * Wires the two panels to one slider. Every number printed here comes out of the running
 * simulation; nothing on this page is a figure that was typed in by hand.
 */

import {
  createRng,
  makeDegreeSequence,
  buildNetwork,
  makeTimetable,
  drawFriendship,
  drawRiderWait,
  summarise,
  predictedInflation,
  degreeAssortativity,
  runNetwork,
} from './inspection-model.js';
import { layoutNetwork, drawNetwork, drawTimeline } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const NETWORK_SIZE = 900;
const MEAN_DEGREE = 10;
const BUS_COUNT = 4000;
const MEAN_HEADWAY = 10;
const DRAWS_PER_FRAME = 900;
const TIMELINE_WINDOW = 14;

/** @param {string} id */
function need(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element;
}

const netCanvas = /** @type {HTMLCanvasElement} */ (need('network-canvas'));
const busCanvas = /** @type {HTMLCanvasElement} */ (need('bus-canvas'));
const netCtx = /** @type {CanvasRenderingContext2D} */ (netCanvas.getContext('2d'));
const busCtx = /** @type {CanvasRenderingContext2D} */ (busCanvas.getContext('2d'));

const cvSlider = /** @type {HTMLInputElement} */ (need('cv'));
const cvValue = need('cv-value');
const playButton = /** @type {HTMLButtonElement} */ (need('play'));
const resetButton = /** @type {HTMLButtonElement} */ (need('reset'));

const predictedBig = need('predicted-big');
const predictedNote = need('predicted-note');
const netBig = need('net-big');
const netNote = need('net-note');
const busBig = need('bus-big');
const busNote = need('bus-note');

const state = {
  cv: Number(cvSlider.value),
  running: true,
  seed: 20260823,
  /** @type {ReturnType<typeof buildNetwork>} */
  network: buildNetwork([1, 1], createRng(1)),
  /** @type {{ x: number, y: number, r: number }[]} */
  layout: [],
  /** @type {ReturnType<typeof makeTimetable>} */
  timetable: makeTimetable({ buses: 2, meanHeadway: 10, cv: 0, rng: createRng(1) }),
  /** @type {ReturnType<typeof createRng>} */
  rng: createRng(1),
  meanDegree: 0,
  realisedNetCv: 0,
  meanHeadway: 0,
  realisedBusCv: 0,
  degreeSum: 0,
  degreeDraws: 0,
  waitSum: 0,
  waitDraws: 0,
  /** @type {readonly [number, number] | null} */
  lastEdge: null,
  lastPerson: 0,
  /** @type {{ gap: number, offset: number } | null} */
  lastRider: null,
  timelineStart: 0,
};

function sizeCanvases() {
  for (const canvas of [netCanvas, busCanvas]) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 480;
    const height = Math.round(width * 0.72);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
}

function rebuild() {
  const rng = createRng(state.seed);
  const degrees = makeDegreeSequence({
    n: NETWORK_SIZE,
    meanDegree: MEAN_DEGREE,
    cv: state.cv,
    rng,
  });
  state.network = buildNetwork(degrees, rng);
  const degreeStats = summarise(state.network.degrees);
  state.meanDegree = degreeStats.mean;
  state.realisedNetCv = degreeStats.cv;
  state.layout = layoutNetwork(state.network, netCanvas.clientWidth || 480, (netCanvas.clientWidth || 480) * 0.72);

  state.timetable = makeTimetable({ buses: BUS_COUNT, meanHeadway: MEAN_HEADWAY, cv: state.cv, rng });
  const headwayStats = summarise(state.timetable.headways);
  state.meanHeadway = headwayStats.mean;
  state.realisedBusCv = headwayStats.cv;

  state.rng = createRng(state.seed ^ 0x5bf03635);
  state.degreeSum = 0;
  state.degreeDraws = 0;
  state.waitSum = 0;
  state.waitDraws = 0;
  state.lastEdge = null;
  state.lastRider = null;
  state.timelineStart = 0;
}

function step() {
  for (let i = 0; i < DRAWS_PER_FRAME; i += 1) {
    const friendship = drawFriendship(state.network, state.rng);
    state.degreeSum += friendship.degree;
    state.degreeDraws += 1;
    state.lastEdge = friendship.edge;
    state.lastPerson = friendship.person;

    const rider = drawRiderWait(state.timetable, state.rng);
    state.waitSum += rider.wait;
    state.waitDraws += 1;
    state.lastRider = { gap: rider.gap, offset: rider.offset };
  }
  if (state.lastRider) {
    state.timelineStart = Math.max(
      0,
      Math.min(state.timetable.headways.length - TIMELINE_WINDOW, state.lastRider.gap - Math.floor(TIMELINE_WINDOW / 2)),
    );
  }
}

function render() {
  const width = netCanvas.clientWidth || 480;
  const height = width * 0.72;
  const sampledMean = state.degreeDraws === 0 ? 0 : state.degreeSum / state.degreeDraws;
  const meanWait = state.waitDraws === 0 ? 0 : state.waitSum / state.waitDraws;
  const netPredictedFactor = predictedInflation(state.realisedNetCv);
  const busPredictedFactor = predictedInflation(state.realisedBusCv);

  drawNetwork(netCtx, width, height, {
    network: state.network,
    layout: state.layout,
    lastEdge: state.lastEdge,
    lastPerson: state.lastPerson,
    meanDegree: state.meanDegree,
    sampledMean,
    predictedMean: state.meanDegree * netPredictedFactor,
    draws: state.degreeDraws,
  });

  drawTimeline(busCtx, busCanvas.clientWidth || 480, (busCanvas.clientWidth || 480) * 0.72, {
    headways: state.timetable.headways,
    windowStart: state.timelineStart,
    windowCount: TIMELINE_WINDOW,
    lastRider: state.lastRider,
    meanHeadway: state.meanHeadway,
    meanWait,
    predictedWait: (state.meanHeadway / 2) * busPredictedFactor,
    draws: state.waitDraws,
  });

  const netInflation = state.meanDegree === 0 ? 0 : sampledMean / state.meanDegree;
  const busInflation = state.meanHeadway === 0 ? 0 : meanWait / (state.meanHeadway / 2);

  const now = performance.now();
  if (now - lastTextUpdate < 250) return;
  lastTextUpdate = now;

  netBig.textContent = state.degreeDraws === 0 ? '\u2014' : `\u00d7${netInflation.toFixed(3)}`;
  netNote.textContent =
    `${sampledMean.toFixed(2)} friends against an average of ${state.meanDegree.toFixed(2)}. ` +
    `Spread of this town: CV ${state.realisedNetCv.toFixed(3)}, so 1 + CV\u00b2 predicts \u00d7${netPredictedFactor.toFixed(3)}. ` +
    `${state.degreeDraws.toLocaleString()} friendships sampled.`;

  busBig.textContent = state.waitDraws === 0 ? '\u2014' : `\u00d7${busInflation.toFixed(3)}`;
  busNote.textContent =
    `${meanWait.toFixed(2)} min waited against ${(state.meanHeadway / 2).toFixed(2)} min expected. ` +
    `Spread of this timetable: CV ${state.realisedBusCv.toFixed(3)}, so 1 + CV\u00b2 predicts \u00d7${busPredictedFactor.toFixed(3)}. ` +
    `${state.waitDraws.toLocaleString()} passengers.`;

  if (state.degreeDraws === 0) {
    predictedBig.textContent = '\u2014';
    predictedNote.textContent = '';
    return;
  }
  predictedBig.textContent =
    `${(netInflation / netPredictedFactor).toFixed(2)} \u00b7 ${(busInflation / busPredictedFactor).toFixed(2)}`;
  predictedNote.textContent =
    'Left number is the town, right number is the bus route. One formula, two unrelated systems, ' +
    'both landing on 1.00. Neither world was told what the other was doing.';
}

function tick() {
  if (state.running) step();
  render();
}

let lastTextUpdate = Number.NEGATIVE_INFINITY;

/** @type {number} */
let timer = 0;

function startLoop() {
  if (timer !== 0) clearInterval(timer);
  timer = setInterval(tick, 33);
}

cvSlider.addEventListener('input', () => {
  state.cv = Number(cvSlider.value);
  cvValue.textContent = state.cv.toFixed(2);
  rebuild();
});

playButton.addEventListener('click', () => {
  state.running = !state.running;
  playButton.textContent = state.running ? 'Pause' : 'Play';
});

resetButton.addEventListener('click', () => {
  state.seed = (state.seed + 977) >>> 0;
  rebuild();
});

window.addEventListener('resize', () => {
  sizeCanvases();
  state.layout = layoutNetwork(state.network, netCanvas.clientWidth || 480, (netCanvas.clientWidth || 480) * 0.72);
});

mountClaimsPanel(need('claims-panel'));

const mixingSlider = /** @type {HTMLInputElement} */ (need('mixing'));
const mixingValue = need('mixing-value');
const mixingResult = need('mixing-result');

function runMixing() {
  const assortativity = Number(mixingSlider.value);
  mixingValue.textContent = assortativity.toFixed(2);
  const run = runNetwork({ n: 2000, draws: 40000, cv: 1.2, seed: 7, assortativity });
  mixingResult.textContent =
    `realised assortativity r = ${run.assortativity.toFixed(3)}\n` +
    `random friendship  \u2192  \u00d7${run.friendshipInflation.toFixed(3)}  (1 + CV\u00b2 = \u00d7${run.predicted.toFixed(3)})\n` +
    `ask a person       \u2192  \u00d7${run.personThenFriendInflation.toFixed(3)}`;
}

mixingSlider.addEventListener('input', runMixing);

sizeCanvases();
cvValue.textContent = state.cv.toFixed(2);
rebuild();
runMixing();
startLoop();
tick();

const assortNote = need('base-assortativity');
assortNote.textContent = degreeAssortativity(state.network).toFixed(3);
