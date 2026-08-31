// @ts-check

/**
 * @fileoverview Main entry point wiring simulation, renderer, audio sonification,
 * preset buttons, and in-browser claims verification.
 */

import {
  DEFAULT_STIMULI,
  optimizeRateDistortion,
  sweepRateDistortionCurve,
  detectBifurcations,
} from './simulation.js';
import { renderFeatureMap, renderRateDistortionCurve } from './renderer.js';
import { initClaimsPanel } from './claims-panel.js';

/**
 * State object
 */
const state = {
  beta: 2.5,
  asymmetry: 1.0,
  domainMode: 'biology', // 'biology' | 'codec'
  stimuli: JSON.parse(JSON.stringify(DEFAULT_STIMULI)),
  audioEnabled: false,
};

/** @type {AudioContext | null} */
let audioCtx = null;

function playAudioChirp(frequency = 440, type = 'sine') {
  if (!state.audioEnabled) return;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = /** @type {OscillatorType} */ (type);
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {
    // Graceful fallback if audio context blocked
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Canvases
  const canvasBio = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-bio'));
  const canvasCodec = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-codec'));
  const canvasCurve = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-curve'));

  // Sliders & Controls
  const betaSlider = /** @type {HTMLInputElement} */ (document.getElementById('beta-slider'));
  const betaValDisplay = document.getElementById('beta-val');
  const asymmetrySlider = /** @type {HTMLInputElement} */ (document.getElementById('asymmetry-slider'));
  const asymmetryValDisplay = document.getElementById('asymmetry-val');
  const audioToggle = /** @type {HTMLButtonElement} */ (document.getElementById('audio-toggle'));
  const shockBtn = /** @type {HTMLButtonElement} */ (document.getElementById('shock-btn'));

  // Metrics
  const metricRate = document.getElementById('metric-rate');
  const metricDist = document.getElementById('metric-distortion');
  const metricClusters = document.getElementById('metric-clusters');
  const metricRisk = document.getElementById('metric-risk');

  // Presets
  const presetStarvation = document.getElementById('preset-starvation');
  const presetForaging = document.getElementById('preset-foraging');
  const presetStudio = document.getElementById('preset-studio');

  // Appendix test runner
  const claimsContainer = /** @type {HTMLElement} */ (document.getElementById('claims-list'));
  const runTestsBtn = /** @type {HTMLButtonElement} */ (document.getElementById('run-tests-btn'));

  if (claimsContainer && runTestsBtn) {
    initClaimsPanel(claimsContainer, runTestsBtn);
  }

  // Pre-calculate baseline sweep curve
  let sweep = sweepRateDistortionCurve(state.stimuli, 0.1, 30.0, 40, state.asymmetry);
  let bifurcations = detectBifurcations(sweep);

  function update() {
    const currentState = optimizeRateDistortion(state.stimuli, state.beta, 6, state.asymmetry);

    // Update canvas visuals
    if (canvasBio) renderFeatureMap(canvasBio, state.stimuli, currentState, 'biology');
    if (canvasCodec) renderFeatureMap(canvasCodec, state.stimuli, currentState, 'codec');
    if (canvasCurve) renderRateDistortionCurve(canvasCurve, sweep, currentState, bifurcations);

    // Update metric cards
    if (metricRate) metricRate.textContent = `${currentState.rate.toFixed(2)} bits`;
    if (metricDist) metricDist.textContent = `${currentState.distortion.toFixed(3)}`;
    if (metricClusters) metricClusters.textContent = `${currentState.effectiveClusters} active`;
    if (metricRisk) {
      metricRisk.textContent = `${(currentState.asymmetricRisk * 100).toFixed(1)}%`;
      metricRisk.style.color = currentState.asymmetricRisk > 0.05 ? '#ef4444' : '#10b981';
    }
  }

  // Recalculate curve when asymmetry changes
  function refreshCurve() {
    sweep = sweepRateDistortionCurve(state.stimuli, 0.1, 30.0, 40, state.asymmetry);
    bifurcations = detectBifurcations(sweep);
    update();
  }

  // Beta slider event
  if (betaSlider && betaValDisplay) {
    betaSlider.addEventListener('input', () => {
      state.beta = parseFloat(betaSlider.value);
      betaValDisplay.textContent = state.beta.toFixed(1);
      playAudioChirp(200 + state.beta * 40, 'triangle');
      update();
    });
  }

  // Asymmetry slider event
  if (asymmetrySlider && asymmetryValDisplay) {
    asymmetrySlider.addEventListener('input', () => {
      state.asymmetry = parseFloat(asymmetrySlider.value);
      asymmetryValDisplay.textContent = state.asymmetry.toFixed(1);
      refreshCurve();
    });
  }

  // Audio toggle
  if (audioToggle) {
    audioToggle.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      audioToggle.textContent = state.audioEnabled ? '🔊 Audio Sonification: ON' : '🔈 Audio Sonification: OFF';
      audioToggle.classList.toggle('active', state.audioEnabled);
      if (state.audioEnabled) playAudioChirp(520, 'sine');
    });
  }

  // Shock button: Inject ambiguous stimulus near decision boundary
  if (shockBtn) {
    shockBtn.addEventListener('click', () => {
      const id = state.stimuli.length;
      const jitter = (Math.random() - 0.5) * 0.1;
      const isThreat = Math.random() > 0.5;
      state.stimuli.push({
        id,
        label: isThreat ? `Spur Shock #${id}` : `Ambiguous Whisper #${id}`,
        features: [0.5 + jitter, 0.5 - jitter, 0.45],
        prior: 0.08,
        isThreat,
      });
      // Normalize priors
      const totalPrior = state.stimuli.reduce((/** @type {number} */ acc, /** @type {any} */ s) => acc + s.prior, 0);
      state.stimuli.forEach((/** @type {any} */ s) => (s.prior /= totalPrior));
      refreshCurve();
      playAudioChirp(880, 'sawtooth');
    });
  }

  // Presets
  if (presetStarvation) {
    presetStarvation.addEventListener('click', () => {
      state.beta = 0.3;
      state.asymmetry = 8.0;
      if (betaSlider) betaSlider.value = '0.3';
      if (betaValDisplay) betaValDisplay.textContent = '0.3';
      if (asymmetrySlider) asymmetrySlider.value = '8.0';
      if (asymmetryValDisplay) asymmetryValDisplay.textContent = '8.0';
      refreshCurve();
      playAudioChirp(150, 'sawtooth');
    });
  }

  if (presetForaging) {
    presetForaging.addEventListener('click', () => {
      state.beta = 3.5;
      state.asymmetry = 2.5;
      if (betaSlider) betaSlider.value = '3.5';
      if (betaValDisplay) betaValDisplay.textContent = '3.5';
      if (asymmetrySlider) asymmetrySlider.value = '2.5';
      if (asymmetryValDisplay) asymmetryValDisplay.textContent = '2.5';
      refreshCurve();
      playAudioChirp(440, 'triangle');
    });
  }

  if (presetStudio) {
    presetStudio.addEventListener('click', () => {
      state.beta = 22.0;
      state.asymmetry = 1.0;
      if (betaSlider) betaSlider.value = '22.0';
      if (betaValDisplay) betaValDisplay.textContent = '22.0';
      if (asymmetrySlider) asymmetrySlider.value = '1.0';
      if (asymmetryValDisplay) asymmetryValDisplay.textContent = '1.0';
      refreshCurve();
      playAudioChirp(750, 'sine');
    });
  }

  // Initial draw
  update();
});
