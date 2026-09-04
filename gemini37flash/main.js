// @ts-check
import { ChiralRibbonSim } from './simulation.js';
import { RibbonRenderer } from './renderer.js';
import { ChiralAudio } from './audio.js';
import { initClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('ribbon-canvas'));
  if (!canvas) return;

  // Initialize Physics Engine
  const sim = new ChiralRibbonSim({
    N: 64,
    J: 1.0,
    h: 0.08,
    temperature: 0.25,
    pinnedEnds: false,
    initialState: 'random'
  });

  // Initialize 3D Renderer & Web Audio
  const renderer = new RibbonRenderer(canvas, sim);
  const audio = new ChiralAudio();

  // Attach Proofs Panel
  const claimsContainer = /** @type {HTMLElement} */ (document.getElementById('claims-panel-container'));
  if (claimsContainer) {
    initClaimsPanel(claimsContainer);
  }

  // DOM Controls
  const biasSlider = /** @type {HTMLInputElement} */ (document.getElementById('bias-slider'));
  const biasVal = /** @type {HTMLElement} */ (document.getElementById('bias-val'));
  const tempSlider = /** @type {HTMLInputElement} */ (document.getElementById('temp-slider'));
  const tempVal = /** @type {HTMLElement} */ (document.getElementById('temp-val'));
  const couplingSlider = /** @type {HTMLInputElement} */ (document.getElementById('coupling-slider'));
  const couplingVal = /** @type {HTMLElement} */ (document.getElementById('coupling-val'));
  const pinnedToggle = /** @type {HTMLInputElement} */ (document.getElementById('pinned-toggle'));

  const viewBtns = document.querySelectorAll('.view-mode-btn');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const audioToggleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('audio-toggle-btn'));
  const resetBtn = /** @type {HTMLButtonElement} */ (document.getElementById('reset-btn'));

  // HUD Readouts
  const eeMeter = /** @type {HTMLElement} */ (document.getElementById('hud-ee-val'));
  const eeBar = /** @type {HTMLElement} */ (document.getElementById('hud-ee-bar'));
  const kinksVal = /** @type {HTMLElement} */ (document.getElementById('hud-kinks-val'));
  const corrVal = /** @type {HTMLElement} */ (document.getElementById('hud-corr-val'));
  const annihilateVal = /** @type {HTMLElement} */ (document.getElementById('hud-annihilate-val'));
  const statusSummary = /** @type {HTMLElement} */ (document.getElementById('hud-status-summary'));

  // Setup control listeners
  biasSlider?.addEventListener('input', () => {
    const val = parseFloat(biasSlider.value);
    sim.h = val;
    if (biasVal) {
      if (val > 0.01) biasVal.textContent = `+${val.toFixed(2)} ((R)-β-pinene / Clockwise)`;
      else if (val < -0.01) biasVal.textContent = `${val.toFixed(2)} ((S)-β-pinene / Counter-CW)`;
      else biasVal.textContent = `0.00 (Racemic / Neutral)`;
    }
  });

  tempSlider?.addEventListener('input', () => {
    const val = parseFloat(tempSlider.value);
    sim.temperature = val;
    if (tempVal) {
      if (val < 0.4) tempVal.textContent = `${val.toFixed(2)} J (-90°C Cryogenic / Ordered)`;
      else if (val < 1.0) tempVal.textContent = `${val.toFixed(2)} J (Intermediate)`;
      else tempVal.textContent = `${val.toFixed(2)} J (Room Temp / Racemized)`;
    }
  });

  couplingSlider?.addEventListener('input', () => {
    const val = parseFloat(couplingSlider.value);
    sim.J = val;
    if (couplingVal) couplingVal.textContent = `${val.toFixed(2)} J`;
  });

  pinnedToggle?.addEventListener('change', () => {
    sim.pinnedEnds = pinnedToggle.checked;
    if (pinnedToggle.checked) {
      // Force pinned boundary conditions
      sim.spins[0] = -1;
      sim.spins[sim.N - 1] = 1;
    }
  });

  viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      viewBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode') || 'graphene';
      renderer.mode = mode;
      sim.systemMode = mode === 'tendril' ? 'tendril' : 'graphene';
    });
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const state = /** @type {import('./simulation.js').InitialState} */ (btn.getAttribute('data-state') || 'random');
      sim.reset(state);
      if (sim.pinnedEnds) {
        sim.spins[0] = -1;
        sim.spins[sim.N - 1] = 1;
      }
    });
  });

  resetBtn?.addEventListener('click', () => {
    sim.reset('random');
  });

  audioToggleBtn?.addEventListener('click', async () => {
    const isEnabled = await audio.toggle();
    if (audioToggleBtn) {
      audioToggleBtn.textContent = isEnabled ? '🔊 Audio: On' : '🔇 Audio: Muted';
      audioToggleBtn.classList.toggle('btn-active', isEnabled);
    }
  });

  // Track previous kinks for sound trigger
  let lastKinks = sim.countPerversionKinks();

  // Main Animation & Physics Loop
  function loop() {
    sim.step(0.05, 3);
    renderer.render();

    const ee = sim.getEnantiomericExcess();
    const kinks = sim.countPerversionKinks();
    const xi = sim.getTheoreticalCorrelationLength();

    // Check for domain wall annihilation acoustic event
    if (kinks < lastKinks) {
      audio.playAnnihilationPop(1.0 + (sim.N - kinks) * 0.02);
    }
    lastKinks = kinks;

    // Update audio synthesis drone
    audio.update(ee);

    // Update HUD metrics
    if (eeMeter) {
      const pct = Math.round(ee * 100);
      eeMeter.textContent = `${pct > 0 ? '+' : ''}${pct}% ee (${ee > 0 ? 'Right / P' : ee < 0 ? 'Left / M' : 'Racemic'})`;
      if (eeBar) {
        // Bar width from 0 to 100% centered
        const barPos = (ee + 1.0) * 50;
        eeBar.style.left = `${Math.min(50, barPos)}%`;
        eeBar.style.width = `${Math.abs(ee) * 50}%`;
        eeBar.style.backgroundColor = ee > 0 ? '#f43f5e' : '#06b6d4';
      }
    }

    if (kinksVal) {
      kinksVal.textContent = `${kinks} ${kinks === 1 ? 'node' : 'nodes'}`;
      kinksVal.style.color = kinks === 0 ? '#10b981' : kinks <= 2 ? '#facc15' : '#ef4444';
    }

    if (corrVal) {
      corrVal.textContent = xi > 1000 ? '∞ (Unified)' : `${xi.toFixed(1)} units`;
    }

    if (annihilateVal) {
      annihilateVal.textContent = `${sim.annihilationEvents}`;
    }

    if (statusSummary) {
      if (kinks === 0) {
        statusSummary.textContent = `Uniform ${ee > 0 ? 'Right-Handed (P)' : 'Left-Handed (M)'} Macroscopic Helix`;
        statusSummary.className = 'hud-status-badge status-uniform';
      } else if (sim.pinnedEnds) {
        statusSummary.textContent = `Pinned Multi-Domain Tendril with ${kinks} Perversion Node(s)`;
        statusSummary.className = 'hud-status-badge status-perversion';
      } else {
        statusSummary.textContent = `Transient Multi-Domain Texture (${kinks} Domain Walls)`;
        statusSummary.className = 'hud-status-badge status-transient';
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
