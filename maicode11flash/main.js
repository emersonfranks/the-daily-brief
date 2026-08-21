import { buildScenario, runCascade, compareThresholds } from './cascade-model.js';
import { renderGrid } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

const slider = document.querySelector('#density-slider');
const densityValue = document.querySelector('#density-value');
const rerollButton = document.querySelector('#reroll-button');
const powerGridElement = document.querySelector('#power-grid');
const rumorGridElement = document.querySelector('#rumor-grid');
const powerMetric = document.querySelector('#power-metric');
const rumorMetric = document.querySelector('#rumor-metric');

const simulation = {
  density: Number(slider.value),
  threshold: 3,
  seed: 101,
};

function updateMetrics(result) {
  powerMetric.textContent = String(result.finalState.cells.flat().filter(Boolean).length);
  rumorMetric.textContent = String(result.finalState.cells.flat().filter(Boolean).length);
}

function updateSimulation() {
  const scenario = buildScenario({
    rows: 12,
    cols: 12,
    threshold: simulation.threshold,
    density: simulation.density,
    seed: simulation.seed,
  });

  const result = runCascade(scenario, 40);
  renderGrid(powerGridElement, result.finalState.cells);
  renderGrid(rumorGridElement, result.finalState.cells.map((row) => row.slice()));
  updateMetrics(result);
}

slider.addEventListener('input', (event) => {
  simulation.density = Number(event.target.value);
  densityValue.textContent = simulation.density.toFixed(2);
  simulation.seed = Math.floor(Math.random() * 1000000);
  updateSimulation();
});

rerollButton.addEventListener('click', () => {
  simulation.seed = Math.floor(Math.random() * 1000000);
  updateSimulation();
});

const comparison = compareThresholds();
console.info('Threshold comparison', comparison);

updateSimulation();
mountClaimsPanel();
