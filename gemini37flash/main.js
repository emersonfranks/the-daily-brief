// @ts-check

import { SocEngine } from './engine.js';
import { SocRenderer } from './renderer.js';
import { ClaimsPanel } from './claims-panel.js';

class AudioSynthesizer {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * @param {number} size
   * @param {number} duration
   */
  playAvalanche(size, duration) {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = size > 1 ? Math.min(880, 180 + Math.log2(size + 1) * 75) : 150;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.type = size > 20 ? 'sawtooth' : 'sine';

      const dur = Math.min(0.4, 0.05 + duration * 0.015);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

class App {
  constructor() {
    this.gridSize = 36;
    this.engine = new SocEngine({
      gridSize: this.gridSize,
      threshold: 4,
      leakRate: 0,
      gain: 1.0,
      seed: Date.now()
    });

    this.engine.warmup(400);

    const simCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('sim-canvas'));
    const chartCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-canvas'));
    this.renderer = new SocRenderer(simCanvas, chartCanvas);
    this.audio = new AudioSynthesizer();

    this.isRunning = true;
    this.isNeuralMode = false;
    this.driveSpeed = 12;
    this.lastFrameTime = performance.now();
    this.dropAccumulator = 0;

    this.latestStats = {
      size: 0,
      duration: 0,
      waveActivity: [0]
    };

    this.initDOM();
    this.initCanvasInteraction(simCanvas);
    this.initClaimsPanel();

    for (let i = 0; i < 60; i++) {
      this.step();
    }

    if (this.claimsPanel) {
      this.claimsPanel.runAll();
    }

    this.animate();
  }

  initDOM() {
    const btnToggle = /** @type {HTMLButtonElement} */ (document.getElementById('btn-toggle-play'));
    const btnStep = /** @type {HTMLButtonElement} */ (document.getElementById('btn-step'));
    const btnReset = /** @type {HTMLButtonElement} */ (document.getElementById('btn-reset'));
    const btnModeSand = /** @type {HTMLButtonElement} */ (document.getElementById('btn-mode-sand'));
    const btnModeNeural = /** @type {HTMLButtonElement} */ (document.getElementById('btn-mode-neural'));

    const sliderLeak = /** @type {HTMLInputElement} */ (document.getElementById('slider-leak'));
    const sliderGain = /** @type {HTMLInputElement} */ (document.getElementById('slider-gain'));
    const sliderSpeed = /** @type {HTMLInputElement} */ (document.getElementById('slider-speed'));

    const valLeak = document.getElementById('val-leak');
    const valGain = document.getElementById('val-gain');
    const valSpeed = document.getElementById('val-speed');

    const btnPresetCritical = document.getElementById('preset-critical');
    const btnPresetSubcritical = document.getElementById('preset-subcritical');
    const btnPresetSupercritical = document.getElementById('preset-supercritical');

    btnToggle?.addEventListener('click', () => {
      this.isRunning = !this.isRunning;
      btnToggle.textContent = this.isRunning ? 'Pause Drive' : 'Resume Drive';
    });

    btnStep?.addEventListener('click', () => {
      this.audio.ensureContext();
      this.step();
    });

    btnReset?.addEventListener('click', () => {
      this.engine.reset();
      this.engine.warmup(300);
      this.updateTelemetry();
    });

    btnModeSand?.addEventListener('click', () => {
      this.isNeuralMode = false;
      btnModeSand.classList.add('active');
      btnModeNeural?.classList.remove('active');
    });

    btnModeNeural?.addEventListener('click', () => {
      this.isNeuralMode = true;
      btnModeNeural.classList.add('active');
      btnModeSand?.classList.remove('active');
    });

    sliderLeak?.addEventListener('input', () => {
      const val = parseFloat(sliderLeak.value);
      this.engine.leakRate = val;
      if (valLeak) valLeak.textContent = val.toFixed(2);
    });

    sliderGain?.addEventListener('input', () => {
      const val = parseFloat(sliderGain.value);
      this.engine.gain = val;
      if (valGain) valGain.textContent = val.toFixed(2);
    });

    sliderSpeed?.addEventListener('input', () => {
      const val = parseInt(sliderSpeed.value, 10);
      this.driveSpeed = val;
      if (valSpeed) valSpeed.textContent = `${val} /s`;
    });

    btnPresetCritical?.addEventListener('click', () => {
      this.applyPreset(0, 1.0);
    });

    btnPresetSubcritical?.addEventListener('click', () => {
      this.applyPreset(0.1, 1.0);
    });

    btnPresetSupercritical?.addEventListener('click', () => {
      this.applyPreset(0, 1.25);
    });
  }

  /**
   * @param {number} leak
   * @param {number} gain
   */
  applyPreset(leak, gain) {
    this.engine.leakRate = leak;
    this.engine.gain = gain;

    const sliderLeak = /** @type {HTMLInputElement} */ (document.getElementById('slider-leak'));
    const sliderGain = /** @type {HTMLInputElement} */ (document.getElementById('slider-gain'));
    const valLeak = document.getElementById('val-leak');
    const valGain = document.getElementById('val-gain');

    if (sliderLeak) sliderLeak.value = leak.toString();
    if (sliderGain) sliderGain.value = gain.toString();
    if (valLeak) valLeak.textContent = leak.toFixed(2);
    if (valGain) valGain.textContent = gain.toFixed(2);

    this.engine.warmup(300);
    this.updateTelemetry();
  }

  /**
   * @param {HTMLCanvasElement} canvas
   */
  initCanvasInteraction(canvas) {
    const handlePointer = (/** @type {MouseEvent | Touch} */ e) => {
      this.audio.ensureContext();
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const xRatio = (clientX - rect.left) / rect.width;
      const yRatio = (clientY - rect.top) / rect.height;

      const cellX = Math.floor(xRatio * this.gridSize);
      const cellY = Math.floor(yRatio * this.gridSize);

      if (cellX >= 0 && cellX < this.gridSize && cellY >= 0 && cellY < this.gridSize) {
        const res = this.engine.drop(cellX, cellY);
        this.latestStats = res;
        this.audio.playAvalanche(res.size, res.duration);
        this.updateTelemetry();
      }
    };

    canvas.addEventListener('mousedown', e => handlePointer(e));
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handlePointer(e.touches[0]);
      }
    }, { passive: false });
  }

  initClaimsPanel() {
    const container = document.getElementById('claims-container');
    if (container) {
      this.claimsPanel = new ClaimsPanel(container);
    }
  }

  step() {
    const x = Math.floor(this.engine.rng() * this.gridSize);
    const y = Math.floor(this.engine.rng() * this.gridSize);
    const res = this.engine.drop(x, y);
    this.latestStats = res;
    if (res.size > 0) {
      this.audio.playAvalanche(res.size, res.duration);
    }
    this.updateTelemetry();
  }

  updateTelemetry() {
    const elSigma = document.getElementById('stat-sigma');
    const elLastSize = document.getElementById('stat-last-size');
    const elTotal = document.getElementById('stat-total-avalanches');
    const elRegime = document.getElementById('stat-regime');

    const sigma = this.engine.getMeanBranchingRatio(300);
    if (elSigma) elSigma.textContent = sigma.toFixed(3);
    if (elLastSize) elLastSize.textContent = `${this.latestStats.size} topples (${this.latestStats.duration} waves)`;
    if (elTotal) elTotal.textContent = this.engine.totalAvalanches.toString();

    if (elRegime) {
      if (this.engine.leakRate > 0.04) {
        elRegime.textContent = 'Subcritical (Damped)';
        elRegime.className = 'regime-sub';
      } else if (this.engine.gain > 1.1) {
        elRegime.textContent = 'Supercritical (Seizure)';
        elRegime.className = 'regime-super';
      } else {
        elRegime.textContent = 'Critical (SOC Attractor)';
        elRegime.className = 'regime-critical';
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (this.isRunning) {
      this.dropAccumulator += dt * this.driveSpeed;
      const dropsToRun = Math.floor(this.dropAccumulator);
      if (dropsToRun > 0) {
        this.dropAccumulator -= dropsToRun;
        for (let i = 0; i < Math.min(dropsToRun, 8); i++) {
          this.step();
        }
      }
    }

    this.renderer.renderLattice(this.engine.grid, this.gridSize, {
      isNeuralMode: this.isNeuralMode,
      activeAvalancheSize: this.latestStats.size,
      activeDuration: this.latestStats.duration,
      activeWaveActivity: this.latestStats.waveActivity
    });

    if (this.engine.historySizes.length >= 20) {
      const fit = SocEngine.fitPowerLaw(this.engine.historySizes, 2, 14);
      this.renderer.renderChart(fit, this.engine.totalAvalanches);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
