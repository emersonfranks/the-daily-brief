// @ts-check

import { PercolationLattice, runMonteCarloSweep } from './percolation-model.js';
import { PercolationRenderer } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

// DOM Elements
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('lattice-canvas'));
const chartCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-canvas'));
const densitySlider = /** @type {HTMLInputElement} */ (document.getElementById('density-slider'));
const densityValDisplay = /** @type {HTMLElement} */ (document.getElementById('density-val'));
const sizeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('size-select'));
const seedButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-randomize'));
const igniteButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-ignite'));
const sweepButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-sweep'));
const tabFire = /** @type {HTMLButtonElement} */ (document.getElementById('tab-fire'));
const tabElectric = /** @type {HTMLButtonElement} */ (document.getElementById('tab-electric'));
const tabClusters = /** @type {HTMLButtonElement} */ (document.getElementById('tab-clusters'));

// Metric Display Elements
const statSpanning = /** @type {HTMLElement} */ (document.getElementById('stat-spanning'));
const statPInf = /** @type {HTMLElement} */ (document.getElementById('stat-p-inf'));
const statClusters = /** @type {HTMLElement} */ (document.getElementById('stat-clusters'));
const statMetricCustom = /** @type {HTMLElement} */ (document.getElementById('stat-metric-custom'));
const statMetricLabel = /** @type {HTMLElement} */ (document.getElementById('stat-metric-label'));

const claimsContainer = /** @type {HTMLElement} */ (document.getElementById('claims-list'));
const runClaimsButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-run-claims'));

// Application State
let currentL = parseInt(sizeSelect.value, 10) || 40;
let currentP = parseFloat(densitySlider.value) || 0.59;
let currentSeed = 1042;
let lattice = new PercolationLattice(currentL);
const renderer = new PercolationRenderer(canvas, chartCanvas);

let fireAnimId = 0;
let isPainting = false;
let paintVal = 1;

/**
 * Update and solve all physical fields for current lattice.
 */
function updatePhysics() {
  lattice.analyzeClusters(currentP);
  const stats = lattice.stats;

  if (!stats) return;

  // Electrical potentials
  const electricalResult = lattice.solveKirchhoffPotentials();
  renderer.setPotentials(electricalResult.potentials);

  // Update UI Stats
  const isSpanning = stats.spansVertical || stats.spansHorizontal;
  if (statSpanning) {
    statSpanning.textContent = isSpanning ? 'PERCOLATING (CONNECTED)' : 'BLOCKED (ISOLATED)';
    statSpanning.className = `stat-val ${isSpanning ? 'stat-positive' : 'stat-warning'}`;
  }

  if (statPInf) {
    statPInf.textContent = `${(stats.pInfinity * 100).toFixed(1)}%`;
  }

  if (statClusters) {
    statClusters.textContent = `${stats.clusterCount}`;
  }

  if (statMetricCustom && statMetricLabel) {
    if (renderer.domainMode === 'fire') {
      statMetricLabel.textContent = 'Fire Risk Barrier';
      statMetricCustom.textContent = isSpanning ? 'Total Basin Burnout' : 'Contained Locally';
    } else if (renderer.domainMode === 'electric') {
      statMetricLabel.textContent = 'Effective Conductance (G)';
      statMetricCustom.textContent = electricalResult.hasConduction
        ? `${electricalResult.conductance.toFixed(3)} S`
        : '0.000 S (Insulator)';
    } else {
      statMetricLabel.textContent = 'Largest Cluster';
      statMetricCustom.textContent = `${stats.maxClusterSize} sites`;
    }
  }

  renderer.setLattice(lattice);
}

/**
 * Populate lattice with fresh random distribution.
 */
function randomizeLattice() {
  currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
  lattice.populate(currentP, currentSeed);
  cancelAnimationFrame(fireAnimId);
  updatePhysics();
}

/**
 * Trigger animated wildfire simulation starting from the left border.
 */
function triggerWildfire() {
  cancelAnimationFrame(fireAnimId);

  // Collect left border occupied sites
  const ignition = [];
  for (let r = 0; r < lattice.L; r++) {
    const idx = lattice.index(r, 0);
    if (lattice.grid[idx] === 1) {
      ignition.push(idx);
    }
  }

  if (ignition.length === 0) {
    // If no tree at left, ignite center site
    const centerIdx = lattice.index(Math.floor(lattice.L / 2), 0);
    lattice.setSite(Math.floor(lattice.L / 2), 0, 1);
    ignition.push(centerIdx);
  }

  const fire = lattice.simulateFire(ignition);
  let maxStep = 0;
  for (let i = 0; i < fire.burnStep.length; i++) {
    if (fire.burnStep[i] > maxStep) maxStep = fire.burnStep[i];
  }

  let step = 0;
  function animate() {
    renderer.setFireState(fire.burnStep, step, maxStep);
    step++;
    if (step <= maxStep + 2) {
      fireAnimId = requestAnimationFrame(animate);
    }
  }
  animate();
}

/**
 * Handle canvas mouse painting / interaction.
 * @param {MouseEvent} evt
 */
function handleCanvasPointer(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const col = Math.floor((x / canvas.clientWidth) * lattice.L);
  const row = Math.floor((y / canvas.clientHeight) * lattice.L);

  if (row >= 0 && row < lattice.L && col >= 0 && col < lattice.L) {
    if (renderer.domainMode === 'fire' && evt.shiftKey) {
      // Ignite specific site on shift-click
      const idx = lattice.index(row, col);
      lattice.setSite(row, col, 1);
      const fire = lattice.simulateFire([idx]);
      let maxStep = 0;
      for (let i = 0; i < fire.burnStep.length; i++) {
        if (fire.burnStep[i] > maxStep) maxStep = fire.burnStep[i];
      }
      let step = 0;
      function animate() {
        renderer.setFireState(fire.burnStep, step, maxStep);
        step++;
        if (step <= maxStep + 2) fireAnimId = requestAnimationFrame(animate);
      }
      animate();
    } else {
      lattice.setSite(row, col, paintVal);
      updatePhysics();
    }
  }
}

// Event Listeners
densitySlider.addEventListener('input', () => {
  currentP = parseFloat(densitySlider.value);
  densityValDisplay.textContent = currentP.toFixed(2);
  randomizeLattice();
});

sizeSelect.addEventListener('change', () => {
  currentL = parseInt(sizeSelect.value, 10);
  lattice = new PercolationLattice(currentL);
  randomizeLattice();
});

seedButton.addEventListener('click', () => {
  randomizeLattice();
});

igniteButton.addEventListener('click', () => {
  if (renderer.domainMode !== 'fire') {
    renderer.domainMode = 'fire';
    updateTabs();
  }
  triggerWildfire();
});

sweepButton.addEventListener('click', () => {
  sweepButton.disabled = true;
  sweepButton.textContent = 'Running Monte Carlo (50 trials)...';
  setTimeout(() => {
    const pValues = [0.1, 0.2, 0.3, 0.4, 0.48, 0.52, 0.56, 0.59, 0.62, 0.66, 0.72, 0.8, 0.9];
    const mcResults = runMonteCarloSweep({
      L: currentL,
      pValues,
      trialsPerP: 40,
      seed: currentSeed,
    });
    renderer.setMonteCarloData(mcResults);
    sweepButton.disabled = false;
    sweepButton.textContent = 'Re-Run Monte Carlo Sweep';
  }, 30);
});

function updateTabs() {
  tabFire.classList.toggle('active', renderer.domainMode === 'fire');
  tabElectric.classList.toggle('active', renderer.domainMode === 'electric');
  tabClusters.classList.toggle('active', renderer.domainMode === 'clusters');
  updatePhysics();
}

tabFire.addEventListener('click', () => {
  renderer.domainMode = 'fire';
  updateTabs();
});

tabElectric.addEventListener('click', () => {
  renderer.domainMode = 'electric';
  updateTabs();
});

tabClusters.addEventListener('click', () => {
  renderer.domainMode = 'clusters';
  updateTabs();
});

// Canvas pointer events
canvas.addEventListener('mousedown', (evt) => {
  isPainting = true;
  paintVal = evt.button === 2 ? 0 : 1; // Left click place, right click erase
  handleCanvasPointer(evt);
});

canvas.addEventListener('mousemove', (evt) => {
  if (isPainting) handleCanvasPointer(evt);
});

window.addEventListener('mouseup', () => {
  isPainting = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize Claims Panel and App
mountClaimsPanel(claimsContainer, runClaimsButton);
randomizeLattice();
