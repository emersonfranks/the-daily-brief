// @ts-check
import { PhysarumNetwork } from './physarum.js';
import { NetworkRenderer } from './renderer.js';
import { mountClaimsPanel } from './claims-panel.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('sim-canvas'));
  if (!canvas) return;

  const network = new PhysarumNetwork({ gamma: 1.2, dt: 0.05, minConductivity: 0.001 });
  const renderer = new NetworkRenderer(canvas, network);

  // HUD Elements
  const hudStep = document.getElementById('hud-step');
  const hudEdges = document.getElementById('hud-edges');
  const hudLength = document.getElementById('hud-length');
  const hudDivergence = document.getElementById('hud-divergence');

  // Controls
  const btnPlayPause = document.getElementById('btn-play-pause');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const btnStep = document.getElementById('btn-step');
  const btnReset = document.getElementById('btn-reset');
  const btnCutMode = document.getElementById('btn-cut-mode');
  const btnRestore = document.getElementById('btn-restore');
  const gammaSlider = /** @type {HTMLInputElement} */ (document.getElementById('gamma-slider'));
  const gammaVal = document.getElementById('gamma-val');

  const presetBtns = document.querySelectorAll('#preset-group .btn-group-btn');
  const modeBtns = document.querySelectorAll('#mode-group .btn-group-btn');

  let isRunning = true;
  let isCutting = false;
  let currentPreset = 'double-bridge';
  let isDraggingNode = false;
  let draggedNodeId = -1;

  // Initialize with double bridge preset
  loadPreset(currentPreset);

  // Mount claims panel
  const proofContainer = document.getElementById('proof-container');
  if (proofContainer) {
    mountClaimsPanel(proofContainer);
  }

  function loadPreset(preset) {
    currentPreset = preset;
    if (preset === 'double-bridge') {
      network.setupDoubleBridge(1.8);
    } else if (preset === 'lattice') {
      network.setupLattice(5, 7, 65);
    } else if (preset === 'fault-tolerant') {
      network.setupFaultTolerantMesh();
    }
    renderer.initParticles(preset === 'lattice' ? 140 : 80);
    updateHUD();
  }

  function updateHUD() {
    if (hudStep) hudStep.textContent = network.stepCount.toString();
    const activeConduits = network.edges.filter(e => !e.severed && e.conductivity > 0.05).length;
    if (hudEdges) hudEdges.textContent = `${activeConduits} / ${network.edges.length}`;
    if (hudLength) hudLength.textContent = `${network.getActiveNetworkLength(0.05).toFixed(0)} px`;
    const divergence = network.getMaxFluxConservationError();
    if (hudDivergence) hudDivergence.textContent = divergence.toExponential(2);
  }

  // Animation & Simulation Loop
  let lastTimestamp = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
    lastTimestamp = now;

    if (isRunning) {
      // 2 sub-steps per frame for smooth physics integration
      network.step();
      network.step();
      updateHUD();
    }

    renderer.render(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Event Listeners: Playback Controls
  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      isRunning = !isRunning;
      if (playIcon && playText) {
        playIcon.textContent = isRunning ? '⏸' : '▶';
        playText.textContent = isRunning ? 'Pause' : 'Resume';
      }
    });
  }

  if (btnStep) {
    btnStep.addEventListener('click', () => {
      isRunning = false;
      if (playIcon && playText) {
        playIcon.textContent = '▶';
        playText.textContent = 'Resume';
      }
      network.step();
      updateHUD();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      loadPreset(currentPreset);
    });
  }

  if (btnCutMode) {
    btnCutMode.addEventListener('click', () => {
      isCutting = !isCutting;
      renderer.isCutting = isCutting;
      btnCutMode.classList.toggle('active', isCutting);
      btnCutMode.style.outline = isCutting ? '2px solid #ef4444' : 'none';
      canvas.style.cursor = isCutting ? 'crosshair' : 'default';
    });
  }

  if (btnRestore) {
    btnRestore.addEventListener('click', () => {
      network.restoreAllEdges();
      updateHUD();
    });
  }

  // Gamma Slider
  if (gammaSlider && gammaVal) {
    gammaSlider.addEventListener('input', () => {
      const g = parseFloat(gammaSlider.value);
      gammaVal.textContent = g.toFixed(1);
      network.gamma = g;
    });
  }

  // Presets
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.getAttribute('data-preset') || 'double-bridge';
      loadPreset(preset);
    });
  });

  // Lens View Modes
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => {
        b.classList.remove('active', 'bio-active', 'net-active');
      });
      const mode = /** @type {'bio'|'network'} */ (btn.getAttribute('data-mode') || 'bio');
      btn.classList.add('active', mode === 'bio' ? 'bio-active' : 'net-active');
      renderer.setMode(mode);
    });
  });

  // Mouse Interactions on Canvas
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const coords = getCanvasCoords(e);

    if (isDraggingNode && draggedNodeId >= 0) {
      const node = network.nodes[draggedNodeId];
      if (node) {
        node.x = Math.max(20, Math.min(canvas.clientWidth - 20, coords.x));
        node.y = Math.max(20, Math.min(canvas.clientHeight - 20, coords.y));
        // Recalculate edge lengths
        for (const edge of network.edges) {
          if (edge.u === draggedNodeId || edge.v === draggedNodeId) {
            const u = network.nodes[edge.u];
            const v = network.nodes[edge.v];
            edge.length = Math.max(1.0, Math.hypot(u.x - v.x, u.y - v.y));
          }
        }
        network.updateFluxes();
      }
      return;
    }

    const hoveredNode = renderer.findNodeAt(coords.x, coords.y);
    renderer.hoveredNodeId = hoveredNode;

    if (hoveredNode < 0) {
      const hoveredEdge = renderer.findEdgeAt(coords.x, coords.y);
      renderer.hoveredEdgeId = hoveredEdge;
    } else {
      renderer.hoveredEdgeId = -1;
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const coords = getCanvasCoords(e);

    if (isCutting) {
      const edgeId = renderer.findEdgeAt(coords.x, coords.y);
      if (edgeId > 0) {
        network.severEdge(edgeId);
        network.updateFluxes();
        updateHUD();
      }
      return;
    }

    const nodeId = renderer.findNodeAt(coords.x, coords.y);
    if (nodeId >= 0) {
      isDraggingNode = true;
      draggedNodeId = nodeId;
      renderer.selectedNodeId = nodeId;
    }
  });

  window.addEventListener('mouseup', () => {
    isDraggingNode = false;
    draggedNodeId = -1;
    renderer.selectedNodeId = -1;
  });
});
