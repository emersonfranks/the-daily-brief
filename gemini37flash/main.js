// @ts-check
import { SandpileModel } from './sandpile-model.js';
import { SandpileRenderer } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  const mainCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('sim-canvas'));
  const plotCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('plot-canvas'));
  const distCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('dist-canvas'));

  if (!mainCanvas || !plotCanvas || !distCanvas) return;

  let modelSize = 64;
  let model = new SandpileModel(modelSize, 42);
  const renderer = new SandpileRenderer(mainCanvas, plotCanvas, distCanvas);

  let isRunning = true;
  let dropsPerFrame = 4;
  let drivingMode = 'stochastic';
  let isPointerDown = false;
  let pointerPos = { x: 0, y: 0 };
  /** @type {Uint8Array|null} */
  let activeTopples = null;

  const statAdded = document.getElementById('stat-added');
  const statTopplings = document.getElementById('stat-topplings');
  const statMeanHeight = document.getElementById('stat-mean-height');
  const statTau = document.getElementById('stat-tau');
  const statMaxAvalanche = document.getElementById('stat-max-avalanche');
  const statDissipated = document.getElementById('stat-dissipated');

  const btnPlayPause = /** @type {HTMLButtonElement} */ (document.getElementById('btn-play-pause'));
  const btnStep = /** @type {HTMLButtonElement} */ (document.getElementById('btn-step'));
  const btnClear = /** @type {HTMLButtonElement} */ (document.getElementById('btn-clear'));
  const btnFastForward = /** @type {HTMLButtonElement} */ (document.getElementById('btn-fastforward'));
  const btnShock = /** @type {HTMLButtonElement} */ (document.getElementById('btn-shock'));
  const sliderSpeed = /** @type {HTMLInputElement} */ (document.getElementById('slider-speed'));
  const valSpeed = document.getElementById('val-speed');
  const drivingSelect = /** @type {HTMLSelectElement} */ (document.getElementById('driving-mode'));
  const sizeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('lattice-size'));

  /** @type {AudioContext|null} */
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
  }

  /**
   * @param {number} avalancheSize
   */
  function playAvalancheSound(avalancheSize) {
    if (!audioCtx || audioCtx.state !== 'running' || avalancheSize <= 0) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      const baseFreq = 120 + Math.min(800, Math.log2(avalancheSize + 1) * 70);
      osc.type = avalancheSize > 100 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.08);

      const volume = Math.min(0.15, 0.02 + Math.log10(avalancheSize + 1) * 0.03);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Audio fallback
    }
  }

  function updateHUD() {
    if (statAdded) statAdded.textContent = model.totalAdded.toLocaleString();
    if (statTopplings) statTopplings.textContent = model.totalTopplings.toLocaleString();
    if (statMeanHeight) statMeanHeight.textContent = model.getMeanHeight().toFixed(3);
    if (statDissipated) statDissipated.textContent = model.totalDissipated.toLocaleString();

    let maxS = 0;
    for (let i = 0; i < model.avalancheHistory.length; i++) {
      if (model.avalancheHistory[i].size > maxS) maxS = model.avalancheHistory[i].size;
    }
    if (statMaxAvalanche) statMaxAvalanche.textContent = maxS.toLocaleString();

    const stats = model.getLogLogDistribution(14);
    if (statTau) {
      if (stats.r2 > 0.5) {
        statTau.textContent = `${Math.abs(stats.slope).toFixed(2)} (R²=${stats.r2.toFixed(2)})`;
      } else {
        statTau.textContent = 'Measuring...';
      }
    }
  }

  function renderAll() {
    renderer.renderGrid(model, activeTopples, {
      brushX: pointerPos.x,
      brushY: pointerPos.y,
      brushRadius: 3
    });
    renderer.renderLogLogPlot(model);
    renderer.renderDistribution(model);
    updateHUD();
  }

  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const skin = /** @type {import('./renderer.js').RenderSkin} */ (btn.getAttribute('data-skin'));
      if (skin) {
        renderer.currentSkin = skin;
        document.querySelectorAll('.skin-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderAll();
      }
    });
  });

  if (sliderSpeed) {
    sliderSpeed.addEventListener('input', () => {
      dropsPerFrame = parseInt(sliderSpeed.value, 10);
      if (valSpeed) valSpeed.textContent = String(dropsPerFrame);
    });
  }

  if (drivingSelect) {
    drivingSelect.addEventListener('change', () => {
      drivingMode = drivingSelect.value;
    });
  }

  if (sizeSelect) {
    sizeSelect.addEventListener('change', () => {
      modelSize = parseInt(sizeSelect.value, 10);
      model = new SandpileModel(modelSize, Date.now() & 0xffff);
      model.fastForward(modelSize * modelSize * 3);
      renderAll();
    });
  }

  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      initAudio();
      isRunning = !isRunning;
      btnPlayPause.textContent = isRunning ? '⏸ Pause' : '▶ Play';
    });
  }

  if (btnStep) {
    btnStep.addEventListener('click', () => {
      initAudio();
      const res = model.dropRandom();
      activeTopples = res.toppledCells;
      if (res.size > 0) playAvalancheSound(res.size);
      renderAll();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      model.reset();
      activeTopples = null;
      renderAll();
    });
  }

  if (btnFastForward) {
    btnFastForward.addEventListener('click', () => {
      initAudio();
      model.fastForward(model.size * model.size * 4);
      activeTopples = null;
      renderAll();
    });
  }

  if (btnShock) {
    btnShock.addEventListener('click', () => {
      initAudio();
      const midX = Math.floor(model.size / 2);
      const midY = Math.floor(model.size / 2);
      const res = model.addGrain(midX, midY, 64);
      activeTopples = res.toppledCells;
      if (res.size > 0) playAvalancheSound(res.size);
      renderAll();
    });
  }

  /**
   * @param {MouseEvent | Touch} e
   */
  function handlePointer(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    const scaleX = model.size / rect.width;
    const scaleY = model.size / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);
    pointerPos = { x, y };

    if (isPointerDown && x >= 0 && x < model.size && y >= 0 && y < model.size) {
      initAudio();
      const res = model.addGrain(x, y, 2);
      activeTopples = res.toppledCells;
      if (res.size > 0) playAvalancheSound(res.size);
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

  function stepSimulation() {
    let biggestAvalanche = 0;
    let combinedTopples = new Uint8Array(model.size * model.size);

    for (let i = 0; i < dropsPerFrame; i++) {
      let res;
      if (drivingMode === 'center') {
        const mid = Math.floor(model.size / 2);
        res = model.addGrain(mid, mid, 1);
      } else {
        res = model.dropRandom();
      }

      if (res.size > biggestAvalanche) {
        biggestAvalanche = res.size;
      }
      for (let c = 0; c < res.toppledCells.length; c++) {
        if (res.toppledCells[c] === 1) combinedTopples[c] = 1;
      }
    }

    activeTopples = combinedTopples;
    if (biggestAvalanche > 0) {
      playAvalancheSound(biggestAvalanche);
    }
  }

  function loop() {
    if (isRunning) {
      stepSimulation();
      renderAll();
    }
    requestAnimationFrame(loop);
  }

  const claimsContainer = document.getElementById('claims-panel-container');
  if (claimsContainer) {
    mountClaimsPanel(claimsContainer);
  }

  model.fastForward(model.size * model.size * 5);
  renderAll();

  if (window.location.search.includes('capture')) {
    model.fastForward(3000);
    renderAll();
    const runBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-run-claims'));
    if (runBtn) {
      runBtn.click();
    }
  }

  requestAnimationFrame(loop);
});
