// @ts-check
import { DensityMotilitySim } from './sim.js';
import { SimRenderer } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvasEl = document.querySelector('#sim-canvas');
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    throw new Error('Canvas element #sim-canvas not found');
  }

  const sim = new DensityMotilitySim();
  const renderer = new SimRenderer(canvasEl, sim);

  let isPlaying = true;
  let animationId = 0;

  // Controls
  const playBtn = document.querySelector('#btn-play');
  const stepBtn = document.querySelector('#btn-step');
  const resetBtn = document.querySelector('#btn-reset');
  const modeMicrobialBtn = document.querySelector('#mode-microbial');
  const modeAstroBtn = document.querySelector('#mode-astro');

  // Sliders
  const thresholdSlider = document.querySelector('#slider-threshold');
  const thresholdVal = document.querySelector('#val-threshold');

  const speedSlider = document.querySelector('#slider-speed');
  const speedVal = document.querySelector('#val-speed');

  const accretionSlider = document.querySelector('#slider-accretion');
  const accretionVal = document.querySelector('#val-accretion');

  const radiusSlider = document.querySelector('#slider-radius');
  const radiusVal = document.querySelector('#val-radius');

  // Presets
  const presetBreathing = document.querySelector('#preset-breathing');
  const presetSuperbubble = document.querySelector('#preset-superbubble');
  const presetCollapse = document.querySelector('#preset-collapse');

  // Telemetry indicators
  const telemPhase = document.querySelector('#telem-phase');
  const telemActive = document.querySelector('#telem-active');
  const telemCavity = document.querySelector('#telem-cavity');
  const telemPeriod = document.querySelector('#telem-period');

  function updateTelemetry() {
    const snap = sim.getSnapshot();
    const breathing = sim.getBreathingMetrics();

    if (telemPhase) telemPhase.textContent = snap.phaseName;
    if (telemActive) telemActive.textContent = `${(snap.activeFraction * 100).toFixed(0)}% (${snap.activeCount})`;
    if (telemCavity) telemCavity.textContent = `${snap.cavitationRatio.toFixed(2)}x`;
    if (telemPeriod) {
      telemPeriod.textContent = breathing.hasOscillation ? `${breathing.period.toFixed(1)}s` : 'Non-periodic';
    }
  }

  function loop() {
    if (isPlaying) {
      sim.step();
      updateTelemetry();
    }
    renderer.render();
    animationId = requestAnimationFrame(loop);
  }

  // Handle Play/Pause
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.textContent = isPlaying ? 'Pause Simulation' : 'Resume Simulation';
      playBtn.classList.toggle('btn-active', isPlaying);
    });
  }

  if (stepBtn) {
    stepBtn.addEventListener('click', () => {
      isPlaying = false;
      if (playBtn) playBtn.textContent = 'Resume Simulation';
      sim.step();
      updateTelemetry();
      renderer.render();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      sim.init(Math.floor(Math.random() * 100000));
      renderer.phaseHistory = [];
      updateTelemetry();
      renderer.render();
    });
  }

  // Handle Domain Mode Switch
  function setMode(/** @type {'microbial' | 'astrophysical'} */ mode) {
    renderer.viewMode = mode;
    sim.config.mode = mode;
    if (modeMicrobialBtn) modeMicrobialBtn.classList.toggle('active', mode === 'microbial');
    if (modeAstroBtn) modeAstroBtn.classList.toggle('active', mode === 'astrophysical');

    const domainTitle = document.querySelector('#domain-mode-title');
    const domainDesc = document.querySelector('#domain-mode-desc');

    if (mode === 'microbial') {
      if (domainTitle) domainTitle.textContent = 'System A: Bacterial Quorum-Sensing Swarm';
      if (domainDesc) {
        domainDesc.textContent =
          'Bacteria secrete autoinducers. Solitary cells drift sluggishly (passive tumble). When local colony density exceeds threshold ρ_c, flagellar motors ignite at high speed, blasting outward down the density gradient.';
      }
    } else {
      if (domainTitle) domainTitle.textContent = 'System B: Interstellar Molecular Gas Cloud';
      if (domainDesc) {
        domainDesc.textContent =
          'Cold interstellar gas contracts under gravity. When core density exceeds the star-formation Jeans threshold ρ_SF, massive OB star clusters ignite, unleashing supernova winds that blast a hollow cavitation superbubble.';
      }
    }
  }

  if (modeMicrobialBtn) {
    modeMicrobialBtn.addEventListener('click', () => setMode('microbial'));
  }
  if (modeAstroBtn) {
    modeAstroBtn.addEventListener('click', () => setMode('astrophysical'));
  }

  // Sliders
  if (thresholdSlider instanceof HTMLInputElement) {
    thresholdSlider.addEventListener('input', () => {
      const val = parseFloat(thresholdSlider.value);
      sim.config.quorumThreshold = val;
      if (thresholdVal) thresholdVal.textContent = val.toFixed(1);
    });
  }

  if (speedSlider instanceof HTMLInputElement) {
    speedSlider.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      sim.config.activeSpeed = val;
      if (speedVal) speedVal.textContent = val.toFixed(1);
    });
  }

  if (accretionSlider instanceof HTMLInputElement) {
    accretionSlider.addEventListener('input', () => {
      const val = parseFloat(accretionSlider.value);
      sim.config.centralPull = val * 0.04;
      sim.config.localAccretion = val * 0.5;
      if (accretionVal) accretionVal.textContent = val.toFixed(2);
    });
  }

  if (radiusSlider instanceof HTMLInputElement) {
    radiusSlider.addEventListener('input', () => {
      const val = parseFloat(radiusSlider.value);
      sim.config.quorumRadius = val;
      if (radiusVal) radiusVal.textContent = `${val}px`;
    });
  }

  // Presets
  if (presetBreathing) {
    presetBreathing.addEventListener('click', () => {
      sim.config.quorumThreshold = 5.8;
      sim.config.activeSpeed = 4.6;
      sim.config.centralPull = 0.02;
      sim.config.localAccretion = 0.3;
      sim.config.quorumRadius = 28;
      sim.init(42);
      if (thresholdSlider instanceof HTMLInputElement) thresholdSlider.value = '5.8';
      if (thresholdVal) thresholdVal.textContent = '5.8';
      if (speedSlider instanceof HTMLInputElement) speedSlider.value = '4.6';
      if (speedVal) speedVal.textContent = '4.6';
      if (accretionSlider instanceof HTMLInputElement) accretionSlider.value = '0.5';
      if (accretionVal) accretionVal.textContent = '0.50';
    });
  }

  if (presetSuperbubble) {
    presetSuperbubble.addEventListener('click', () => {
      sim.config.quorumThreshold = 4.5;
      sim.config.activeSpeed = 6.2;
      sim.config.centralPull = 0.008;
      sim.config.localAccretion = 0.15;
      sim.config.quorumRadius = 35;
      sim.init(108);
      if (thresholdSlider instanceof HTMLInputElement) thresholdSlider.value = '4.5';
      if (thresholdVal) thresholdVal.textContent = '4.5';
      if (speedSlider instanceof HTMLInputElement) speedSlider.value = '6.2';
      if (speedVal) speedVal.textContent = '6.2';
    });
  }

  if (presetCollapse) {
    presetCollapse.addEventListener('click', () => {
      sim.config.quorumThreshold = 20.0; // Unreachable threshold
      sim.config.activeSpeed = 0.25;
      sim.config.centralPull = 0.025;
      sim.config.localAccretion = 0.4;
      sim.init(200);
      if (thresholdSlider instanceof HTMLInputElement) thresholdSlider.value = '20.0';
      if (thresholdVal) thresholdVal.textContent = '20.0';
      if (speedSlider instanceof HTMLInputElement) speedSlider.value = '0.2';
      if (speedVal) speedVal.textContent = '0.2';
    });
  }

  // Canvas interaction: Click to inject perturbation
  canvasEl.addEventListener('pointerdown', (evt) => {
    const rect = canvasEl.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * sim.config.width;
    const y = ((evt.clientY - rect.top) / rect.height) * sim.config.height;

    // Inject cluster of particles at click point
    for (let i = 0; i < 20; i++) {
      const p = sim.particles[i % sim.particles.length];
      const rad = Math.random() * 15;
      const ang = Math.random() * Math.PI * 2;
      p.x = x + rad * Math.cos(ang);
      p.y = y + rad * Math.sin(ang);
      p.density = sim.config.quorumThreshold + 3.0; // Trigger instant blast
    }
  });

  // Handle Window Resize
  window.addEventListener('resize', () => {
    renderer.resize();
  });

  // Mount Claims Proof Panel
  const claimsContainer = document.querySelector('#claims-container');
  if (claimsContainer instanceof HTMLElement) {
    mountClaimsPanel(claimsContainer);
  }

  // Start loop
  setMode('microbial');
  renderer.resize();
  loop();
});
