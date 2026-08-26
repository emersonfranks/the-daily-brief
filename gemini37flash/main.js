// @ts-check

import {
  DoubleWellSimulator,
  NeuronSimulator,
  runDoubleWellNoiseSweep
} from './stochastic-resonance.js';
import { VisualRenderer } from './renderer.js';
import { initClaimsPanel } from './claims-panel.js';

let climateSim = new DoubleWellSimulator({ noiseIntensity: 0.12, amplitude: 0.18, frequency: 0.04, dt: 0.05 });
let neuronSim = new NeuronSimulator({ noiseIntensity: 2.8, amplitude: 10.0, frequency: 0.04, dt: 0.05 });

const canvasClimate = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-climate'));
const canvasNeuron = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-neuron'));
const canvasSpectrum = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas-spectrum'));

const renderer = new VisualRenderer(canvasClimate, canvasNeuron, canvasSpectrum);

const sliderNoise = /** @type {HTMLInputElement} */ (document.getElementById('slider-noise'));
const sliderAmplitude = /** @type {HTMLInputElement} */ (document.getElementById('slider-amplitude'));
const sliderFrequency = /** @type {HTMLInputElement} */ (document.getElementById('slider-frequency'));

const labelNoise = /** @type {HTMLElement} */ (document.getElementById('label-noise'));
const labelAmplitude = /** @type {HTMLElement} */ (document.getElementById('label-amplitude'));
const labelFrequency = /** @type {HTMLElement} */ (document.getElementById('label-frequency'));

const btnPresetZero = /** @type {HTMLButtonElement} */ (document.getElementById('btn-preset-zero'));
const btnPresetOpt = /** @type {HTMLButtonElement} */ (document.getElementById('btn-preset-opt'));
const btnPresetHigh = /** @type {HTMLButtonElement} */ (document.getElementById('btn-preset-high'));
const btnSweep = /** @type {HTMLButtonElement} */ (document.getElementById('btn-run-sweep'));

const claimsContainer = /** @type {HTMLElement} */ (document.getElementById('claims-panel-container'));

/** @type {import('./stochastic-resonance.js').SweepPoint[]} */
let currentSweep = runDoubleWellNoiseSweep(16, 50);

function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;
  const list = [canvasClimate, canvasNeuron, canvasSpectrum];
  for (const c of list) {
    const rect = c.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
    }
  }
}

window.addEventListener('resize', resizeCanvases);

function updateParams() {
  const noiseNorm = parseFloat(sliderNoise.value);
  const ampNorm = parseFloat(sliderAmplitude.value);
  const freqNorm = parseFloat(sliderFrequency.value);

  const wellNoise = noiseNorm * 0.35;
  const neuronNoise = noiseNorm * 8.0;

  const wellAmp = ampNorm * 0.30;
  const neuronAmp = ampNorm * 18.0;

  climateSim.noiseIntensity = wellNoise;
  climateSim.amplitude = wellAmp;
  climateSim.frequency = freqNorm;

  neuronSim.noiseIntensity = neuronNoise;
  neuronSim.amplitude = neuronAmp;
  neuronSim.frequency = freqNorm;

  labelNoise.textContent = `D = ${wellNoise.toFixed(3)} (Neuron σ = ${neuronNoise.toFixed(1)})`;
  labelAmplitude.textContent = `A = ${wellAmp.toFixed(3)}`;
  labelFrequency.textContent = `f = ${freqNorm.toFixed(3)} Hz`;
}

sliderNoise.addEventListener('input', updateParams);
sliderAmplitude.addEventListener('input', updateParams);
sliderFrequency.addEventListener('input', updateParams);

btnPresetZero.addEventListener('click', () => {
  sliderNoise.value = '0.00';
  updateParams();
});

btnPresetOpt.addEventListener('click', () => {
  sliderNoise.value = '0.34';
  updateParams();
});

btnPresetHigh.addEventListener('click', () => {
  sliderNoise.value = '0.95';
  updateParams();
});

btnSweep.addEventListener('click', () => {
  btnSweep.disabled = true;
  btnSweep.textContent = 'Computing Sweep...';
  setTimeout(() => {
    currentSweep = runDoubleWellNoiseSweep(20, Math.floor(Math.random() * 1000));
    btnSweep.disabled = false;
    btnSweep.textContent = 'Re-Run Noise Sweep';
  }, 30);
});

let isRunning = true;

function loop() {
  if (isRunning) {
    const cStep = climateSim.step(2);
    const nStep = neuronSim.step(2);

    renderer.pushData(cStep.x, cStep.signal, nStep.v, nStep.spiked);

    renderer.renderClimate(cStep.x, cStep.signal, climateSim.noiseIntensity, climateSim.a, climateSim.b);
    renderer.renderNeuron(nStep.v, neuronSim.vThreshold, neuronSim.vRest);
    renderer.renderResonanceCurve(currentSweep, climateSim.noiseIntensity, 0.40);
  }
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', () => {
  resizeCanvases();
  updateParams();
  initClaimsPanel(claimsContainer);
  requestAnimationFrame(loop);
});
