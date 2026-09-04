// @ts-check

/**
 * @fileoverview Main entry point for the Nonreciprocal Chasing & Arrested Coarsening interactive experience.
 * Wires DOM controls, simulation loop, canvas sizing, audio engine, and claims panel.
 */

import { NonreciprocalSimulation } from './simulation.js';
import { EcologicalDualSimulation } from './ecological-dual.js';
import { SimRenderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { ClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  // Canvases and Renderers
  const canvasMain = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-main'));
  if (!canvasMain) return;

  const renderer = new SimRenderer(canvasMain);
  const audio = new AudioEngine();

  // Simulations
  const simColloids = new NonreciprocalSimulation({
    width: 400,
    height: 400,
    numA: 120,
    numB: 120,
    noise: 0.1
  });

  const simEco = new EcologicalDualSimulation(48);

  // Mode state: 'colloids' | 'ecological'
  let currentMode = 'colloids';
  let isRunning = true;

  // DOM Elements
  const sliderAsymmetry = /** @type {HTMLInputElement} */ (document.getElementById('slider-asymmetry'));
  const valAsymmetry = document.getElementById('val-asymmetry');
  const sliderDensity = /** @type {HTMLInputElement} */ (document.getElementById('slider-density'));
  const valDensity = document.getElementById('val-density');
  const sliderNoise = /** @type {HTMLInputElement} */ (document.getElementById('slider-noise'));
  const valNoise = document.getElementById('val-noise');

  const btnModeColloids = document.getElementById('btn-mode-colloids');
  const btnModeEco = document.getElementById('btn-mode-eco');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnAudio = document.getElementById('btn-audio');

  // Monitor Metric Displays
  const metricMomentum = document.getElementById('metric-momentum');
  const metricClusters = document.getElementById('metric-clusters');
  const metricEntropy = document.getElementById('metric-entropy');
  const metricPairs = document.getElementById('metric-pairs');
  const stateLabel = document.getElementById('phase-state-label');

  // Initialize Claims Panel
  const claimsContainer = document.getElementById('claims-panel-container');
  if (claimsContainer) {
    new ClaimsPanel(claimsContainer);
  }

  // Update Asymmetry
  function updateAsymmetryFromSlider() {
    if (!sliderAsymmetry) return;
    const asym = parseFloat(sliderAsymmetry.value);
    if (valAsymmetry) valAsymmetry.textContent = asym.toFixed(2);

    simColloids.setAsymmetry(asym);

    // Also modulate ecological nonreciprocal cross-taxis
    simEco.params.taxisPreyEvasion = 0.6 * asym;
    simEco.params.taxisPredPursuit = 0.8 * asym;

    if (stateLabel) {
      if (asym <= 0.05) {
        stateLabel.textContent = 'Reciprocal Equilibrium (Static Phase Separation / Coarsened Droplets)';
        stateLabel.className = 'phase-badge equilibrium';
      } else if (asym < 0.6) {
        stateLabel.textContent = 'Weak Nonreciprocity (Emergent Chasing & Cluster Shear)';
        stateLabel.className = 'phase-badge transition';
      } else {
        stateLabel.textContent = 'Active Nonreciprocal Phase (Arrested Coarsening & Traveling Waves)';
        stateLabel.className = 'phase-badge active-phase';
      }
    }
  }

  sliderAsymmetry?.addEventListener('input', updateAsymmetryFromSlider);
  updateAsymmetryFromSlider();

  // Update Density
  sliderDensity?.addEventListener('input', () => {
    const total = parseInt(sliderDensity.value, 10);
    if (valDensity) valDensity.textContent = total.toString();
    simColloids.config.numA = Math.floor(total / 2);
    simColloids.config.numB = Math.ceil(total / 2);
    simColloids.reset();
  });

  // Update Noise
  sliderNoise?.addEventListener('input', () => {
    const noiseVal = parseFloat(sliderNoise.value);
    if (valNoise) valNoise.textContent = noiseVal.toFixed(2);
    simColloids.config.noise = noiseVal;
  });

  // Mode Switches
  btnModeColloids?.addEventListener('click', () => {
    currentMode = 'colloids';
    btnModeColloids.classList.add('active');
    btnModeEco?.classList.remove('active');
  });

  btnModeEco?.addEventListener('click', () => {
    currentMode = 'ecological';
    btnModeEco.classList.add('active');
    btnModeColloids?.classList.remove('active');
  });

  // Play / Pause / Reset
  btnPlayPause?.addEventListener('click', () => {
    isRunning = !isRunning;
    btnPlayPause.textContent = isRunning ? '⏸ Pause' : '▶ Resume';
  });

  btnReset?.addEventListener('click', () => {
    simColloids.reset();
    simEco.reset();
    updateAsymmetryFromSlider();
  });

  btnAudio?.addEventListener('click', () => {
    const enabled = audio.toggle();
    btnAudio.textContent = enabled ? '🔊 Sound: On' : '🔇 Sound: Off';
    btnAudio.classList.toggle('active', enabled);
  });

  // Handle Window Resize
  window.addEventListener('resize', () => {
    renderer.setupResolution();
  });

  // Animation Loop
  let lastMetricUpdate = 0;

  function animate(timestamp) {
    if (isRunning) {
      if (currentMode === 'colloids') {
        simColloids.step();
      } else {
        simEco.step();
      }
    }

    // Render
    if (currentMode === 'colloids') {
      renderer.renderColloids(simColloids, 'colloid');
    } else {
      renderer.renderEcologicalField(simEco);
    }

    // Update real-time metrics periodically (every 100ms)
    if (timestamp - lastMetricUpdate > 100) {
      lastMetricUpdate = timestamp;
      if (currentMode === 'colloids') {
        const m = simColloids.computeMetrics();
        if (metricMomentum) metricMomentum.textContent = m.netMomentum.toFixed(2);
        if (metricClusters) metricClusters.textContent = m.clusterCount.toString();
        if (metricEntropy) metricEntropy.textContent = `${m.spatialEntropy.toFixed(2)} bits`;
        if (metricPairs) metricPairs.textContent = m.chasePairCount.toString();

        const asym = parseFloat(sliderAsymmetry?.value || '1');
        audio.update(m.netMomentum, asym);
      } else {
        const em = simEco.computeMetrics();
        if (metricMomentum) metricMomentum.textContent = (em.waveActivity * 1000).toFixed(2);
        if (metricClusters) metricClusters.textContent = em.isExtinct ? '0 (Extinct)' : 'Stable';
        if (metricEntropy) metricEntropy.textContent = `${(em.preyHomogeneity * 100).toFixed(0)}% Homog`;
        if (metricPairs) metricPairs.textContent = `${em.preyTotal.toFixed(0)} / ${em.predatorTotal.toFixed(0)}`;
      }
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
});
