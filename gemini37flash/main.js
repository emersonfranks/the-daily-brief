// @ts-check

/**
 * @fileoverview Main controller entry point wiring UI controls, simulation loop,
 * canvas interactions, and empirical test runner.
 */

import { TuringSimulation, PRESETS } from './turing-model.js';
import { TuringRenderer } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  const mainCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('sim-canvas'));
  const profileCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('profile-canvas'));
  const waveCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wave-canvas'));

  if (!mainCanvas || !profileCanvas || !waveCanvas) return;

  const sim = new TuringSimulation({
    width: 96,
    height: 96,
    Du: PRESETS.LEOPARD_SPOTS.Du,
    Dv: PRESETS.LEOPARD_SPOTS.Dv,
    F: PRESETS.LEOPARD_SPOTS.F,
    k: PRESETS.LEOPARD_SPOTS.k,
    slopeAdvection: PRESETS.LEOPARD_SPOTS.slopeAdvection
  });

  const renderer = new TuringRenderer(mainCanvas, profileCanvas, waveCanvas);
  renderer.currentSkin = 'split';

  // HUD Elements
  const statSteps = document.getElementById('stat-steps');
  const statCoverage = document.getElementById('stat-coverage');
  const statWavelength = document.getElementById('stat-wavelength');
  const statDepletion = document.getElementById('stat-depletion');
  const domainLabelA = document.getElementById('domain-label-a');
  const domainLabelB = document.getElementById('domain-label-b');

  // Sliders & Controls
  const sliderF = /** @type {HTMLInputElement} */ (document.getElementById('slider-f'));
  const sliderK = /** @type {HTMLInputElement} */ (document.getElementById('slider-k'));
  const sliderDu = /** @type {HTMLInputElement} */ (document.getElementById('slider-du'));
  const sliderDv = /** @type {HTMLInputElement} */ (document.getElementById('slider-dv'));
  const sliderSlope = /** @type {HTMLInputElement} */ (document.getElementById('slider-slope'));
  const sliderSpeed = /** @type {HTMLInputElement} */ (document.getElementById('slider-speed'));

  const valF = document.getElementById('val-f');
  const valK = document.getElementById('val-k');
  const valDu = document.getElementById('val-du');
  const valDv = document.getElementById('val-dv');
  const valSlope = document.getElementById('val-slope');

  const btnPlayPause = /** @type {HTMLButtonElement} */ (document.getElementById('btn-play-pause'));
  const btnStep = /** @type {HTMLButtonElement} */ (document.getElementById('btn-step'));
  const btnReset = /** @type {HTMLButtonElement} */ (document.getElementById('btn-reset'));
  const brushModeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('brush-mode'));

  let isRunning = true;
  let stepsPerFrame = 8;
  let isPointerDown = false;
  let pointerPos = { x: 0, y: 0 };

  function updateControlDisplays() {
    if (sliderF && valF) {
      sliderF.value = String(sim.F);
      valF.textContent = sim.F.toFixed(3);
    }
    if (sliderK && valK) {
      sliderK.value = String(sim.k);
      valK.textContent = sim.k.toFixed(3);
    }
    if (sliderDu && valDu) {
      sliderDu.value = String(sim.Du);
      valDu.textContent = sim.Du.toFixed(2);
    }
    if (sliderDv && valDv) {
      sliderDv.value = String(sim.Dv);
      valDv.textContent = sim.Dv.toFixed(2);
    }
    if (sliderSlope && valSlope) {
      sliderSlope.value = String(sim.slopeAdvection);
      valSlope.textContent = sim.slopeAdvection.toFixed(2);
    }
  }

  function loadPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    sim.Du = preset.Du;
    sim.Dv = preset.Dv;
    sim.F = preset.F;
    sim.k = preset.k;
    sim.slopeAdvection = preset.slopeAdvection;
    sim.reset('multi_spot');

    if (domainLabelA) domainLabelA.textContent = preset.domainA;
    if (domainLabelB) domainLabelB.textContent = preset.domainB;

    updateControlDisplays();

    // Update active preset button highlight
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetKey);
    });
  }

  // Bind Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset');
      if (key) loadPreset(key);
    });
  });

  // Bind Skin View Selector
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const skin = /** @type {import('./renderer.js').RenderSkin} */ (btn.getAttribute('data-skin'));
      if (skin) {
        renderer.currentSkin = skin;
        document.querySelectorAll('.skin-btn').forEach(b => b.classList.toggle('active', b === btn));
      }
    });
  });

  // Slider events
  if (sliderF) {
    sliderF.addEventListener('input', () => {
      sim.F = parseFloat(sliderF.value);
      if (valF) valF.textContent = sim.F.toFixed(3);
    });
  }
  if (sliderK) {
    sliderK.addEventListener('input', () => {
      sim.k = parseFloat(sliderK.value);
      if (valK) valK.textContent = sim.k.toFixed(3);
    });
  }
  if (sliderDu) {
    sliderDu.addEventListener('input', () => {
      sim.Du = parseFloat(sliderDu.value);
      if (valDu) valDu.textContent = sim.Du.toFixed(2);
    });
  }
  if (sliderDv) {
    sliderDv.addEventListener('input', () => {
      sim.Dv = parseFloat(sliderDv.value);
      if (valDv) valDv.textContent = sim.Dv.toFixed(2);
    });
  }
  if (sliderSlope) {
    sliderSlope.addEventListener('input', () => {
      sim.slopeAdvection = parseFloat(sliderSlope.value);
      if (valSlope) valSlope.textContent = sim.slopeAdvection.toFixed(2);
    });
  }
  if (sliderSpeed) {
    sliderSpeed.addEventListener('input', () => {
      stepsPerFrame = parseInt(sliderSpeed.value, 10);
    });
  }

  // Play / Pause / Reset
  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      isRunning = !isRunning;
      btnPlayPause.textContent = isRunning ? '⏸ Pause' : '▶ Play';
    });
  }
  if (btnStep) {
    btnStep.addEventListener('click', () => {
      sim.step(10);
      renderAll();
    });
  }
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      sim.reset('multi_spot');
      renderAll();
    });
  }

  // Canvas interaction (Painting / Injecting)
  /**
   * @param {MouseEvent | Touch} e
   */
  function handlePointer(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    const scaleX = sim.width / rect.width;
    const scaleY = sim.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    pointerPos = { x, y };

    // Select row for cross-section
    renderer.selectedRow = Math.floor(y);

    if (isPointerDown) {
      const mode = brushModeSelect ? brushModeSelect.value : 'activator';
      const radius = 4;
      if (mode === 'activator') {
        sim.inject(x, y, radius, 0.4, 0);
      } else if (mode === 'water') {
        sim.inject(x, y, radius, 0, 0.5);
      } else if (mode === 'drought') {
        sim.inject(x, y, radius, -0.4, -0.4);
      }
    }
  }

  mainCanvas.addEventListener('mousedown', e => {
    isPointerDown = true;
    handlePointer(e);
  });
  window.addEventListener('mouseup', () => {
    isPointerDown = false;
  });
  mainCanvas.addEventListener('mousemove', e => {
    handlePointer(e);
  });

  // Touch support
  mainCanvas.addEventListener('touchstart', e => {
    if (e.touches.length > 0) {
      isPointerDown = true;
      handlePointer(e.touches[0]);
    }
  }, { passive: true });
  window.addEventListener('touchend', () => {
    isPointerDown = false;
  });
  mainCanvas.addEventListener('touchmove', e => {
    if (e.touches.length > 0) {
      handlePointer(e.touches[0]);
    }
  }, { passive: true });

  function renderAll() {
    renderer.renderField(sim, {
      brushX: pointerPos.x,
      brushY: pointerPos.y,
      brushRadius: 4
    });
    renderer.renderProfile(sim);
    renderer.renderAutocorrelation(sim);

    const stats = sim.getStats();
    const wave = sim.measureWavelength(24);
    const halo = sim.measureDepletionHalo();

    if (statSteps) statSteps.textContent = String(sim.stepCount);
    if (statCoverage) statCoverage.textContent = `${(stats.activeCoverage * 100).toFixed(1)}%`;
    if (statWavelength) statWavelength.textContent = wave.dominantWavelength > 0 ? `${wave.dominantWavelength} px` : 'None';
    if (statDepletion) statDepletion.textContent = `${(halo.depletionRatio * 100).toFixed(0)}%`;
  }

  function loop() {
    if (isRunning) {
      sim.step(stepsPerFrame);
      renderAll();
    }
    requestAnimationFrame(loop);
  }

  // Mount Claims Panel
  const claimsContainer = document.getElementById('claims-panel-container');
  if (claimsContainer) {
    mountClaimsPanel(claimsContainer);
  }

  // Initial setup
  loadPreset('LEOPARD_SPOTS');

  // If capture flag is present in URL, fast-forward 1000 steps and run claims suite immediately
  if (window.location.search.includes('capture')) {
    sim.step(1000);
    renderAll();
    const runBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-run-claims'));
    if (runBtn) {
      runBtn.click();
    }
  }

  requestAnimationFrame(loop);
});
