// @ts-check
import {
  makeRng,
  sampleGaps,
  degreeSequence,
  configurationModel,
  adjacency,
  rewireAssortative,
  meanOf,
  cvOf,
  sizeBiasedMean,
  predictedInflation,
  edgeEndpointMeanDegree,
  personAveragedFriendDegree,
  degreeAssortativity,
} from './sizebias.js';
import { fitCanvas, histogramOf, makeHistogram, addToHistogram, drawTimetable, drawTown } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const PEOPLE = 2500;
const GAPS = 4000;
const MEAN_GAP = 10;
const MEAN_FRIENDS = 6;
const SHOWN_GAPS = 36;
const BINS = 46;

/** @param {string} id */
function need(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}

const busCanvas = /** @type {HTMLCanvasElement} */ (need('bus-canvas'));
const townCanvas = /** @type {HTMLCanvasElement} */ (need('town-canvas'));
const spreadInput = /** @type {HTMLInputElement} */ (need('spread'));
const sortInput = /** @type {HTMLInputElement} */ (need('sorting'));
const resetButton = /** @type {HTMLButtonElement} */ (need('reset'));

/** @type {ReturnType<typeof buildState>} */
let state;

/**
 * @param {number} cv
 * @param {number} swaps
 */
function buildState(cv, swaps) {
  const rng = makeRng(20260826);
  const gaps = sampleGaps(rng, GAPS, MEAN_GAP, cv);
  const degrees = degreeSequence(rng, PEOPLE, MEAN_FRIENDS, cv);
  const neutral = configurationModel(rng, degrees);
  const graph = swaps > 0 ? rewireAssortative(rng, neutral, swaps) : neutral;
  const adj = adjacency(graph);

  const gapMean = meanOf(gaps);
  const degMean = meanOf(degrees);
  let maxDeg = 1;
  for (let i = 0; i < degrees.length; i++) maxDeg = Math.max(maxDeg, degrees[i]);

  const gapHi = gapMean * 5;
  const degBins = Math.min(maxDeg + 1, BINS);
  const cumulative = new Float64Array(gaps.length + 1);
  for (let i = 0; i < gaps.length; i++) cumulative[i + 1] = cumulative[i] + gaps[i];

  return {
    cv,
    swaps,
    rng: makeRng(7717),
    gaps,
    cumulative,
    gapMean,
    gapCv: cvOf(gaps),
    graph,
    adj,
    degrees,
    degMean,
    degCv: cvOf(degrees),
    maxDeg,
    gapTruth: histogramOf(gaps, BINS, 0, gapHi),
    gapLived: makeHistogram(BINS, 0, gapHi),
    degTruth: histogramOf(degrees, degBins, 0, maxDeg + 1),
    degLived: makeHistogram(degBins, 0, maxDeg + 1),
    busSum: 0,
    busN: 0,
    friendSum: 0,
    friendN: 0,
    focusGap: 0,
    arrivalFrac: 0.5,
    focusPerson: 0,
    pickedFriend: -1,
    tick: 0,
    exactBus: sizeBiasedMean(gaps) / gapMean,
    exactFriendship: edgeEndpointMeanDegree(graph) / degMean,
    exactPerson: personAveragedFriendDegree(adj, degrees) / degMean,
    predicted: predictedInflation(degrees),
    predictedGaps: predictedInflation(gaps),
    assortativity: degreeAssortativity(graph),
  };
}

/** One uniformly random instant on the timetable; report the gap it fell inside. */
function dropArrival() {
  const total = state.cumulative[state.gaps.length];
  const x = state.rng() * total;
  let lo = 0;
  let hi = state.gaps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (state.cumulative[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  addToHistogram(state.gapLived, state.gaps[lo]);
  state.busSum += state.gaps[lo];
  state.busN += 1;
  return { index: lo, frac: (x - state.cumulative[lo]) / state.gaps[lo] };
}

/** Pick a person at random, then one of their friends at random. */
function askAboutAFriend() {
  let person = Math.floor(state.rng() * state.adj.length);
  while (state.adj[person].length === 0) person = Math.floor(state.rng() * state.adj.length);
  const friends = state.adj[person];
  const picked = friends[Math.floor(state.rng() * friends.length)];
  addToHistogram(state.degLived, state.degrees[picked]);
  state.friendSum += state.degrees[picked];
  state.friendN += 1;
  return { person, picked };
}

/**
 * @param {number} x
 * @param {number} places
 */
function fixed(x, places) {
  return Number.isFinite(x) ? x.toFixed(places) : '\u2013';
}

function paintReadouts() {
  need('r-predicted').textContent = `\u00d7${fixed(state.predictedGaps, 2)}`;
  need('r-bus').textContent = `\u00d7${fixed(state.busN > 0 ? state.busSum / state.busN / state.gapMean : NaN, 2)}`;
  need('r-friend').textContent = `\u00d7${fixed(state.friendN > 0 ? state.friendSum / state.friendN / state.degMean : NaN, 2)}`;
  need('r-exact-friendship').textContent = `\u00d7${fixed(state.exactFriendship, 2)}`;
  need('r-assort').textContent = fixed(state.assortativity, 2);
  need('r-samples').textContent = `${(state.busN + state.friendN).toLocaleString()} samples drawn`;
  need('v-spread').textContent = fixed(state.cv, 2);
  need('v-gapcv').textContent = fixed(state.gapCv, 2);
  need('v-degcv').textContent = fixed(state.degCv, 2);
  need('v-sorting').textContent = state.swaps === 0 ? 'off' : `r = ${fixed(state.assortativity, 2)}`;

  const drift = Math.abs(state.exactPerson / state.predicted - 1);
  const warn = need('drift-note');
  warn.textContent =
    state.swaps === 0
      ? `Asking each person lands ${fixed(drift * 100, 1)}% off the formula \u2014 within the 4% the unsorted case was measured to hold.`
      : `Asking each person is now ${fixed(drift * 100, 1)}% off the formula. Picking a random friendship is still exact.`;
  warn.className = drift > 0.04 ? 'note broken' : 'note';
}

function frame() {
  state.tick += 1;
  for (let i = 0; i < 30; i++) {
    const arrival = dropArrival();
    const ask = askAboutAFriend();
    if (i === 0 && state.tick % 12 === 0) {
      state.focusGap = arrival.index < SHOWN_GAPS ? arrival.index : Math.floor(state.rng() * SHOWN_GAPS);
      state.arrivalFrac = arrival.frac;
      state.focusPerson = ask.person;
      state.pickedFriend = ask.picked;
    }
  }

  const busCtx = fitCanvas(busCanvas);
  if (busCtx) {
    drawTimetable(busCtx, busCanvas.clientWidth, busCanvas.clientHeight, {
      gaps: state.gaps,
      shown: SHOWN_GAPS,
      focus: state.focusGap,
      truth: state.gapTruth,
      lived: state.gapLived,
      arrivalFrac: state.arrivalFrac,
    });
  }
  const townCtx = fitCanvas(townCanvas);
  if (townCtx) {
    drawTown(townCtx, townCanvas.clientWidth, townCanvas.clientHeight, {
      degrees: state.degrees,
      friends: state.adj[state.focusPerson] ?? [],
      focus: state.focusPerson,
      picked: state.pickedFriend,
      truth: state.degTruth,
      lived: state.degLived,
    });
  }
  paintReadouts();
  handle = window.requestAnimationFrame(frame);
}

/** @type {number} */
let handle = 0;

function rebuild() {
  state = buildState(Number(spreadInput.value), Number(sortInput.value));
  paintReadouts();
}

spreadInput.addEventListener('input', rebuild);
sortInput.addEventListener('input', rebuild);
resetButton.addEventListener('click', () => {
  spreadInput.value = '0.8';
  sortInput.value = '0';
  rebuild();
});

rebuild();
handle = window.requestAnimationFrame(frame);

mountClaimsPanel(need('claims-root'));

Object.defineProperty(window, 'dailyBrief', {
  value: {
    freeze: () => window.cancelAnimationFrame(handle),
    settle: (/** @type {number} */ steps) => {
      for (let i = 0; i < steps; i++) {
        dropArrival();
        askAboutAFriend();
      }
      paintReadouts();
    },
  },
});
