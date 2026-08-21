// @ts-check
import { KuramotoModel } from './kuramoto-model.js';
import { SimulationRenderer } from './renderer.js';
import { TimeSeriesChart } from './charts.js';
import { ClaimsPanel } from './claims-panel.js';

function init() {
  const model = new KuramotoModel({
    oscillatorCount: 52,
    couplingStrength: 2.5,
    frequencySpread: 0.8,
    baseFrequency: 2.0,
    timeStep: 0.02,
    topology: 'all-to-all',
    seed: 42
  });

  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('sim-canvas'));
  if (!canvas) return;
  const renderer = new SimulationRenderer(canvas, model);

  const chartCanvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('chart-canvas'));
  if (!chartCanvas) return;
  const chart = new TimeSeriesChart(chartCanvas, 180);

  const claimsContainer = document.getElementById('claims-panel-container');
  if (claimsContainer) {
    new ClaimsPanel(claimsContainer);
  }

  const couplingSlider = /** @type {HTMLInputElement|null} */ (document.getElementById('slider-coupling'));
  const couplingVal = document.getElementById('val-coupling');
  const spreadSlider = /** @type {HTMLInputElement|null} */ (document.getElementById('slider-spread'));
  const spreadVal = document.getElementById('val-spread');

  const metricOrder = document.getElementById('metric-order');
  const metricLocked = document.getElementById('metric-locked');
  const metricVariance = document.getElementById('metric-variance');

  if (couplingSlider && couplingVal) {
    couplingSlider.addEventListener('input', () => {
      const k = parseFloat(couplingSlider.value);
      couplingVal.textContent = k.toFixed(2);
      model.setCoupling(k);
    });
  }

  if (spreadSlider && spreadVal) {
    spreadSlider.addEventListener('input', () => {
      const s = parseFloat(spreadSlider.value);
      spreadVal.textContent = s.toFixed(2);
      model.setSpread(s);
    });
  }

  const btnShock = document.getElementById('btn-shock');
  if (btnShock) {
    btnShock.addEventListener('click', () => {
      model.perturbFraction(0.4);
    });
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      model.init();
    });
  }

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode') || 'fireflies';
      renderer.setViewMode(mode);
    });
  });

  const presetSub = document.getElementById('preset-subcritical');
  if (presetSub && couplingSlider && couplingVal) {
    presetSub.addEventListener('click', () => {
      couplingSlider.value = '0.3';
      couplingVal.textContent = '0.30';
      model.setCoupling(0.3);
    });
  }

  const presetCrit = document.getElementById('preset-critical');
  if (presetCrit && couplingSlider && couplingVal) {
    presetCrit.addEventListener('click', () => {
      couplingSlider.value = '1.3';
      couplingVal.textContent = '1.30';
      model.setCoupling(1.3);
    });
  }

  const presetSuper = document.getElementById('preset-supercritical');
  if (presetSuper && couplingSlider && couplingVal) {
    presetSuper.addEventListener('click', () => {
      couplingSlider.value = '3.8';
      couplingVal.textContent = '3.80';
      model.setCoupling(3.8);
    });
  }

  window.addEventListener('resize', () => {
    renderer.resize();
    chart.resize();
  });

  let frameCount = 0;
  function animate() {
    model.step();
    renderer.render();

    const metrics = model.getMetrics();
    chart.push(metrics.orderParameter);
    chart.render();

    frameCount++;
    if (frameCount % 4 === 0) {
      if (metricOrder) metricOrder.textContent = metrics.orderParameter.toFixed(3);
      if (metricLocked) metricLocked.textContent = `${(metrics.lockedFraction * 100).toFixed(0)}%`;
      if (metricVariance) metricVariance.textContent = metrics.frequencyVariance.toFixed(4);
    }

    requestAnimationFrame(animate);
  }

  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
