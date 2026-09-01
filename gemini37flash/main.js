// @ts-check
import { DoubleDiffusiveSim } from './simulation.js';
import { SimRenderer } from './renderer.js';
import { initClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('sim-canvas'));
  const profileCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('profile-canvas'));
  const claimsContainer = /** @type {HTMLElement} */ (document.getElementById('claims-panel-container'));

  if (!canvas || !profileCanvas) return;

  // Initialize Simulation Engine (64x64 grid for high fidelity in real-time)
  let currentPreset = 'ocean';
  let sim = new DoubleDiffusiveSim({
    nx: 64,
    ny: 64,
    rRho: 1.5,
    tau: 0.03,
    prandtl: 7.0,
    raT: 30000,
    seed: 42
  });

  const renderer = new SimRenderer(canvas, sim);
  renderer.setDomainTheme('ocean');

  // Initialize Claims Verification Appendix
  if (claimsContainer) {
    initClaimsPanel(claimsContainer);
  }

  // UI Element References
  const playPauseBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-play-pause'));
  const stepBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-step'));
  const resetBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-reset'));

  const rRhoSlider = /** @type {HTMLInputElement} */ (document.getElementById('slider-rrho'));
  const rRhoVal = /** @type {HTMLElement} */ (document.getElementById('val-rrho'));
  const tauSlider = /** @type {HTMLInputElement} */ (document.getElementById('slider-tau'));
  const tauVal = /** @type {HTMLElement} */ (document.getElementById('val-tau'));
  const raTSlider = /** @type {HTMLInputElement} */ (document.getElementById('slider-rat'));
  const raTVal = /** @type {HTMLElement} */ (document.getElementById('val-rat'));
  const prSlider = /** @type {HTMLInputElement} */ (document.getElementById('slider-pr'));
  const prVal = /** @type {HTMLElement} */ (document.getElementById('val-pr'));

  const keGauge = /** @type {HTMLElement} */ (document.getElementById('gauge-ke'));
  const nuGauge = /** @type {HTMLElement} */ (document.getElementById('gauge-nu'));
  const gammaGauge = /** @type {HTMLElement} */ (document.getElementById('gauge-gamma'));
  const fingersGauge = /** @type {HTMLElement} */ (document.getElementById('gauge-fingers'));

  const presetBtns = document.querySelectorAll('.preset-btn');
  const viewBtns = document.querySelectorAll('.view-btn');
  const toolBtns = document.querySelectorAll('.tool-btn');
  const particleToggle = /** @type {HTMLInputElement} */ (document.getElementById('toggle-particles'));
  const vectorToggle = /** @type {HTMLInputElement} */ (document.getElementById('toggle-vectors'));

  let isRunning = true;
  let currentTool = 'inject'; // 'inject', 'stir', 'probe'
  let isPointerDown = false;

  // Preset Configurations
  const presets = {
    ocean: {
      rRho: 1.5,
      tau: 0.03,
      prandtl: 7.0,
      raT: 30000,
      theme: 'ocean',
      desc: 'Subtropical Atlantic Thermocline: Warm, high-salinity water over cooler fresh abyss (Pr = 7.0, tau = 0.03).'
    },
    whitedwarf: {
      rRho: 1.5,
      tau: 0.015,
      prandtl: 0.5,
      raT: 30000,
      theme: 'whitedwarf',
      desc: 'Polluted White Dwarf Envelope: Accreted asteroid iron debris floating over hydrogen mantle (Pr = 0.5, tau = 0.015).'
    },
    controldiff: {
      rRho: 1.5,
      tau: 1.0,
      prandtl: 2.0,
      raT: 30000,
      theme: 'ocean',
      desc: 'Equal Diffusivity Control: Identical background density but tau = 1.0; proves zero fingers can form without differential diffusion.'
    },
    highrrho: {
      rRho: 35.0,
      tau: 0.03,
      prandtl: 2.0,
      raT: 30000,
      theme: 'ocean',
      desc: 'High Density Ratio Threshold: Strong thermal stratification (R_rho > 1/tau) shuts down fingering instability.'
    },
    overturn: {
      rRho: 0.8,
      tau: 0.03,
      prandtl: 2.0,
      raT: 30000,
      theme: 'whitedwarf',
      desc: 'Rayleigh-Taylor Direct Overturn: Top-heavy density stratification (R_rho < 1.0) creates violent turbulent overturning.'
    }
  };

  /**
   * Apply a named preset
   * @param {string} key
   */
  function applyPreset(key) {
    const config = presets[key];
    if (!config) return;

    currentPreset = key;
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === key);
    });

    rRhoSlider.value = String(config.rRho);
    rRhoVal.textContent = config.rRho.toFixed(2);

    tauSlider.value = String(config.tau);
    tauVal.textContent = config.tau.toFixed(3);

    raTSlider.value = String(config.raT);
    raTVal.textContent = String(config.raT);

    prSlider.value = String(config.prandtl);
    prVal.textContent = config.prandtl.toFixed(1);

    renderer.setDomainTheme(/** @type {'ocean' | 'whitedwarf'} */ (config.theme));

    const bannerDesc = document.getElementById('preset-description');
    if (bannerDesc) bannerDesc.textContent = config.desc;

    sim = new DoubleDiffusiveSim({
      nx: 64,
      ny: 64,
      rRho: config.rRho,
      tau: config.tau,
      prandtl: config.prandtl,
      raT: config.raT,
      seed: Math.floor(Math.random() * 10000)
    });
    renderer.setSimulation(sim);
  }

  // Setup Event Listeners
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      if (p) applyPreset(p);
    });
  });

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view');
      if (mode) {
        viewBtns.forEach(b => b.classList.toggle('active', b === btn));
        renderer.setViewMode(/** @type {'composition' | 'temperature' | 'vorticity' | 'density'} */ (mode));
      }
    });
  });

  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      if (tool) {
        toolBtns.forEach(b => b.classList.toggle('active', b === btn));
        currentTool = tool;
      }
    });
  });

  if (particleToggle) {
    particleToggle.addEventListener('change', () => {
      renderer.showParticles = particleToggle.checked;
    });
  }

  if (vectorToggle) {
    vectorToggle.addEventListener('change', () => {
      renderer.showVelocityField = vectorToggle.checked;
    });
  }

  // Sliders
  rRhoSlider.addEventListener('input', () => {
    const val = parseFloat(rRhoSlider.value);
    rRhoVal.textContent = val.toFixed(2);
    sim.setParameters({ rRho: val });
  });

  tauSlider.addEventListener('input', () => {
    const val = parseFloat(tauSlider.value);
    tauVal.textContent = val.toFixed(3);
    sim.setParameters({ tau: val });
  });

  raTSlider.addEventListener('input', () => {
    const val = parseFloat(raTSlider.value);
    raTVal.textContent = String(val);
    sim.setParameters({ raT: val });
  });

  prSlider.addEventListener('input', () => {
    const val = parseFloat(prSlider.value);
    prVal.textContent = val.toFixed(1);
    sim.setParameters({ prandtl: val });
  });

  // Buttons
  playPauseBtn.addEventListener('click', () => {
    isRunning = !isRunning;
    playPauseBtn.textContent = isRunning ? 'Pause Simulation' : 'Resume Simulation';
    playPauseBtn.classList.toggle('btn-paused', !isRunning);
  });

  stepBtn.addEventListener('click', () => {
    sim.step(0.001);
  });

  resetBtn.addEventListener('click', () => {
    sim.initFields();
    sim.initParticles();
  });

  // Interactive Pointer Interactions
  /**
   * @param {MouseEvent | Touch} e
   */
  function handlePointerAction(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const normX = x / rect.width;
    const normY = y / rect.height;

    renderer.probeX = x;
    renderer.probeY = y;

    if (isPointerDown) {
      if (currentTool === 'inject') {
        sim.injectSolute(normX, normY, 0.08, 0.4);
      } else if (currentTool === 'stir') {
        sim.stir(normX, normY, 40.0);
      }
    }
  }

  canvas.addEventListener('mousedown', e => {
    isPointerDown = true;
    handlePointerAction(e);
  });

  window.addEventListener('mouseup', () => {
    isPointerDown = false;
  });

  canvas.addEventListener('mousemove', e => {
    handlePointerAction(e);
  });

  canvas.addEventListener('mouseleave', () => {
    renderer.probeX = -1;
    renderer.probeY = -1;
    isPointerDown = false;
  });

  // Touch Support
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length > 0) {
      isPointerDown = true;
      handlePointerAction(e.touches[0]);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length > 0) {
      handlePointerAction(e.touches[0]);
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    isPointerDown = false;
    renderer.probeX = -1;
    renderer.probeY = -1;
  });

  // Animation & Diagnostic Loop
  let frameCount = 0;
  function animate() {
    if (isRunning) {
      sim.step(0.001);
    }

    renderer.render();

    // Update charts & diagnostics every 4 frames
    if (frameCount % 4 === 0) {
      renderer.renderProfiles(profileCanvas);

      const ke = sim.getKineticEnergy();
      const fluxes = sim.getFluxes();
      const spec = sim.getFingerSpectrum();

      if (keGauge) keGauge.textContent = ke < 0.001 ? ke.toExponential(2) : ke.toFixed(2);
      if (nuGauge) nuGauge.textContent = fluxes.nusseltS.toFixed(1) + 'x';
      if (gammaGauge) gammaGauge.textContent = fluxes.fluxRatio > 0 ? fluxes.fluxRatio.toFixed(3) : '0.000';
      if (fingersGauge) fingersGauge.textContent = String(spec.fingerCount);
    }

    frameCount++;
    requestAnimationFrame(animate);
  }

  // Initial preset application and animation start
  applyPreset('ocean');
  requestAnimationFrame(animate);
});
