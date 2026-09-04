// @ts-check
/**
 * Entry point. Wires the domain module to the renderer and the controls, and
 * writes every figure in the copy from the live run rather than from anything
 * typed in by hand.
 */

import { CONFIG, standardGraph, compareAtCapacity, sweep, makeRng, meanDegree, kappa } from './network.js';
import { forceLayout } from './layout.js';
import { drawNetwork, drawCharts } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const graph = standardGraph();
const pos = forceLayout(graph, makeRng(4242));
const rows = sweep(graph, [...CONFIG.capacities], CONFIG.a, CONFIG.controlSeed);

/** @param {string} id */
const el = (id) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
};

const slider = /** @type {HTMLInputElement} */ (el('capacity'));
const minCapacity = Math.min(...CONFIG.capacities);
const maxCapacity = Math.max(...CONFIG.capacities);
slider.min = String(minCapacity);
slider.max = String(maxCapacity);

// A ?capacity= deep link, so a particular point on the slider can be shared.
const requested = Number(new URLSearchParams(window.location.search).get('capacity'));
const startCapacity =
  Number.isFinite(requested) && requested >= minCapacity && requested <= maxCapacity
    ? Math.round(requested)
    : maxCapacity;
slider.value = String(startCapacity);

const canvasAttention = /** @type {HTMLCanvasElement} */ (el('net-attention'));
const canvasAttack = /** @type {HTMLCanvasElement} */ (el('net-attack'));
const canvasControl = /** @type {HTMLCanvasElement} */ (el('net-control'));
const canvasChart = /** @type {HTMLCanvasElement} */ (el('chart'));

/** @param {number} v */
const pct = (v) => `${(v * 100).toFixed(1)}%`;

let current = Number(slider.value);

function render() {
  const r = compareAtCapacity(graph, current, CONFIG.a, CONFIG.controlSeed);

  drawNetwork(canvasAttention, graph, pos, {
    edgeAlive: (e) => r.cascade.edgeActive[e],
    nodeGone: () => false,
    inGiant: (i) => r.attentionComponentOf[i] !== -1,
  });

  const attackGone = new Uint8Array(graph.n);
  for (const i of r.attackRemoved) attackGone[i] = 1;
  drawNetwork(canvasAttack, graph, pos, {
    edgeAlive: (e) => {
      const [u, v] = graph.edges[e];
      return attackGone[u] === 0 && attackGone[v] === 0;
    },
    nodeGone: (i) => attackGone[i] === 1,
    inGiant: (i) => r.attackComponentOf[i] !== -1,
  });

  const controlGone = new Uint8Array(graph.n);
  for (const i of r.controlRemoved) controlGone[i] = 1;
  drawNetwork(canvasControl, graph, pos, {
    edgeAlive: (e) => {
      const [u, v] = graph.edges[e];
      return controlGone[u] === 0 && controlGone[v] === 0;
    },
    nodeGone: (i) => controlGone[i] === 1,
    inGiant: (i) => r.controlComponentOf[i] !== -1,
  });

  drawCharts(canvasChart, rows, current);

  el('cap-readout').textContent = String(current);
  el('quiet-count').textContent = `${r.quietCount} of ${graph.n}`;
  el('over-count').textContent = String(r.overCapacityCount);
  el('s-attention').textContent = pct(r.attentionFraction);
  el('s-attack').textContent = pct(r.attackFraction);
  el('s-control').textContent = pct(r.controlFraction);
  el('kappa-attention').textContent = r.kappaAttention.toFixed(2);

  const alpha = r.attackLikeness;
  const verdictValue = el('verdict-value');
  const verdictText = el('verdict-text');
  const bar = /** @type {HTMLElement} */ (el('verdict-bar-fill'));
  if (alpha === null) {
    verdictValue.textContent = '\u2014';
    verdictText.textContent =
      'Too little damage yet for the comparison to mean anything: bad luck and a targeted attack would both leave this network essentially intact.';
    bar.style.width = '0%';
  } else {
    verdictValue.textContent = alpha.toFixed(2);
    bar.style.width = `${Math.max(0, Math.min(1, alpha)) * 100}%`;
    verdictText.textContent =
      alpha < 0.25
        ? 'Behaving like bad luck. The busiest people fell silent first, and it made almost no difference \u2014 the network absorbed it exactly as if the same number of people had dropped out at random.'
        : alpha < 0.6
          ? 'In between, and moving. The network has started to notice which people went quiet.'
          : 'Behaving like a targeted attack. Nobody was removed and there is no attacker, yet the network has broken up almost as thoroughly as if someone had picked off its biggest hubs deliberately.';
  }
}

slider.addEventListener('input', () => {
  current = Number(slider.value);
  render();
});

for (const button of document.querySelectorAll('[data-capacity]')) {
  button.addEventListener('click', () => {
    current = Number(/** @type {HTMLElement} */ (button).dataset.capacity);
    slider.value = String(current);
    render();
  });
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(render, 120);
});

// ---- figures in the prose, written from this run ----
const defined = rows.filter((r) => r.attackLikeness !== null);
const crossing = defined.find((r) => /** @type {number} */ (r.attackLikeness) >= 0.5);
const lastCalm = defined
  .filter((r) => /** @type {number} */ (r.attackLikeness) <= 0.15)
  .reduce((a, b) => (a.capacity < b.capacity ? a : b));

el('fig-n').textContent = String(graph.n);
el('fig-edges').textContent = String(graph.edges.length);
el('fig-meandeg').textContent = meanDegree(graph.degree).toFixed(2);
el('fig-maxdeg').textContent = String(Math.max(...graph.degree));
el('fig-kappa0').textContent = kappa(graph.degree).toFixed(2);

if (crossing) {
  for (const id of ['fig-cross-cap', 'fig-cross-cap2']) el(id).textContent = String(crossing.capacity);
  for (const id of ['fig-cross-att', 'fig-cross-att2']) el(id).textContent = pct(crossing.attention);
  el('fig-cross-over').textContent = String(crossing.overCapacityCount);
  el('fig-cross-overpct').textContent = pct(crossing.overCapacityCount / graph.n);
  el('fig-cross-atk').textContent = pct(crossing.attack);
  el('fig-cross-rnd').textContent = pct(crossing.control);
  el('fig-cross-cut').textContent = pct(crossing.cutoffAttack);
  el('fig-cross-alpha').textContent = /** @type {number} */ (crossing.attackLikeness).toFixed(2);
}
el('fig-calm-cap').textContent = String(lastCalm.capacity);
el('fig-calm-alpha').textContent = /** @type {number} */ (lastCalm.attackLikeness).toFixed(2);
el('fig-calm-att').textContent = pct(lastCalm.attention);
el('fig-calm-rnd').textContent = pct(lastCalm.control);
el('fig-calm-atk').textContent = pct(lastCalm.attack);
el('fig-window').textContent = crossing ? String(lastCalm.capacity - crossing.capacity) : '\u2014';

mountClaimsPanel(el('claims-root'));
render();
