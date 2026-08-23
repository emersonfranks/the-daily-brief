// @ts-check

/**
 * @fileoverview Visual renderer for Reaction-Diffusion Morphogenesis.
 * Supports dual-skin domain rendering (Mammalian Pelt vs. Arid Satellite Landscape vs. Morphogen Fields),
 * real-time cross-section profile graphs, and autocorrelation spectrum visualization.
 */

import { TuringSimulation } from './turing-model.js';

/**
 * @typedef {'pelt' | 'satellite' | 'morphogen' | 'split'} RenderSkin
 */

export class TuringRenderer {
  /**
   * @param {HTMLCanvasElement} mainCanvas
   * @param {HTMLCanvasElement} profileCanvas
   * @param {HTMLCanvasElement} waveCanvas
   */
  constructor(mainCanvas, profileCanvas, waveCanvas) {
    this.mainCanvas = mainCanvas;
    this.mainCtx = /** @type {CanvasRenderingContext2D} */ (mainCanvas.getContext('2d'));

    this.profileCanvas = profileCanvas;
    this.profileCtx = /** @type {CanvasRenderingContext2D} */ (profileCanvas.getContext('2d'));

    this.waveCanvas = waveCanvas;
    this.waveCtx = /** @type {CanvasRenderingContext2D} */ (waveCanvas.getContext('2d'));

    /** @type {RenderSkin} */
    this.currentSkin = 'split';

    this.selectedRow = -1; // -1 = center row

    // Reusable image buffer
    this.imgData = this.mainCtx.createImageData(mainCanvas.width, mainCanvas.height);
  }

  /**
   * Resizes image buffer if canvas dimensions change.
   * @param {number} width
   * @param {number} height
   */
  resizeBuffer(width, height) {
    if (this.mainCanvas.width !== width || this.mainCanvas.height !== height) {
      this.mainCanvas.width = width;
      this.mainCanvas.height = height;
      this.imgData = this.mainCtx.createImageData(width, height);
    }
  }

  /**
   * Renders the 2D field onto the main canvas.
   * @param {TuringSimulation} sim
   * @param {{ brushX?: number, brushY?: number, brushRadius?: number }} [brushInfo]
   */
  renderField(sim, brushInfo) {
    const w = sim.width;
    const h = sim.height;
    this.resizeBuffer(w, h);

    const data = this.imgData.data;
    const skin = this.currentSkin;
    const halfW = Math.floor(w / 2);

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const idx = rowOffset + x;
        const u = sim.u[idx];
        const v = sim.v[idx];
        const pixelIdx = idx * 4;

        let activeSkin = skin;
        if (skin === 'split') {
          activeSkin = x < halfW ? 'pelt' : 'satellite';
        }

        let r = 0, g = 0, b = 0;

        if (activeSkin === 'pelt') {
          // Mammalian Pelt Skin:
          // Activator V = Melanin (Dark Brown/Black pigment #1f1209 to #0a0502)
          // Substrate U = Tawny Golden Fur base (#d99b43 to #e8b86d)
          const melanin = Math.min(1.0, Math.max(0.0, v * 2.2));
          const baseR = 217 * (0.8 + 0.2 * u);
          const baseG = 155 * (0.8 + 0.2 * u);
          const baseB = 67 * (0.8 + 0.2 * u);

          r = Math.round(baseR * (1 - melanin) + 24 * melanin);
          g = Math.round(baseG * (1 - melanin) + 16 * melanin);
          b = Math.round(baseB * (1 - melanin) + 12 * melanin);
        } else if (activeSkin === 'satellite') {
          // Satellite Landscape Skin:
          // Activator V = Lush Plant Canopy / Biomass (Deep Emerald / Forest Green #135e28)
          // Substrate U = Soil Moisture (Moist clay #8a5836 vs. Hyper-arid red sand #c27142)
          const plant = Math.min(1.0, Math.max(0.0, v * 2.3));
          const soilR = 194 * (0.6 + 0.4 * (1.0 - u));
          const soilG = 113 * (0.6 + 0.4 * u);
          const soilB = 66 * (0.5 + 0.5 * u);

          r = Math.round(soilR * (1 - plant) + 19 * plant);
          g = Math.round(soilG * (1 - plant) + 104 * plant);
          b = Math.round(soilB * (1 - plant) + 40 * plant);
        } else {
          // Morphogen Field:
          // Heatmap: Activator V in bright Cyan/Magenta, Substrate U in background deep Blue
          const cyan = Math.min(1.0, v * 2.5);
          r = Math.round(255 * (cyan * 0.9));
          g = Math.round(200 * (1.0 - u) + 50 * cyan);
          b = Math.round(255 * u * 0.8 + 255 * cyan);
        }

        // Draw split divider line if in split mode
        if (skin === 'split' && (x === halfW - 1 || x === halfW)) {
          r = 255;
          g = 255;
          b = 255;
        }

        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = 255;
      }
    }

    this.mainCtx.putImageData(this.imgData, 0, 0);

    // Draw overlay guide for selected cross-section row
    const targetRow = this.selectedRow >= 0 ? this.selectedRow : Math.floor(h / 2);
    this.mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    this.mainCtx.lineWidth = 1;
    this.mainCtx.setLineDash([3, 3]);
    this.mainCtx.beginPath();
    this.mainCtx.moveTo(0, targetRow + 0.5);
    this.mainCtx.lineTo(w, targetRow + 0.5);
    this.mainCtx.stroke();
    this.mainCtx.setLineDash([]);

    // Draw interactive brush ring if active
    if (brushInfo && brushInfo.brushX !== undefined && brushInfo.brushY !== undefined) {
      this.mainCtx.strokeStyle = '#38bdf8';
      this.mainCtx.lineWidth = 1.5;
      this.mainCtx.beginPath();
      this.mainCtx.arc(brushInfo.brushX, brushInfo.brushY, brushInfo.brushRadius ?? 5, 0, Math.PI * 2);
      this.mainCtx.stroke();
    }
  }

  /**
   * Renders the 1D Cross-Section profile graph showing activator peak and moisture depletion halo.
   * @param {TuringSimulation} sim
   */
  renderProfile(sim) {
    const ctx = this.profileCtx;
    const canvas = this.profileCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const simW = sim.width;
    const targetRow = this.selectedRow >= 0 ? this.selectedRow : Math.floor(sim.height / 2);

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0.25; y <= 0.75; y += 0.25) {
      ctx.moveTo(0, y * h);
      ctx.lineTo(w, y * h);
    }
    ctx.stroke();

    const uPoints = [];
    const vPoints = [];

    for (let x = 0; x < simW; x++) {
      const idx = targetRow * simW + x;
      const px = (x / (simW - 1)) * w;
      const pyU = (1.0 - sim.u[idx]) * (h - 20) + 10;
      const pyV = (1.0 - sim.v[idx]) * (h - 20) + 10;
      uPoints.push({ x: px, y: pyU });
      vPoints.push({ x: px, y: pyV });
    }

    // Draw Substrate U (Moisture / Inhibitor) - Blue/Amber line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < uPoints.length; i++) {
      if (i === 0) ctx.moveTo(uPoints[i].x, uPoints[i].y);
      else ctx.lineTo(uPoints[i].x, uPoints[i].y);
    }
    ctx.stroke();

    // Draw Activator V (Biomass / Melanin) - Green/Magenta line
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < vPoints.length; i++) {
      if (i === 0) ctx.moveTo(vPoints[i].x, vPoints[i].y);
      else ctx.lineTo(vPoints[i].x, vPoints[i].y);
    }
    ctx.stroke();

    // Legend
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Substrate U (Moisture/Inhibitor)', 8, 14);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('Activator V (Biomass/Pigment)', w - 160, 14);
  }

  /**
   * Renders the Spatial Autocorrelation curve and extracted wavelength.
   * @param {TuringSimulation} sim
   */
  renderAutocorrelation(sim) {
    const ctx = this.waveCtx;
    const canvas = this.waveCanvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const wave = sim.measureWavelength(24);
    const corr = wave.correlation;
    const len = corr.length;
    const midY = h * 0.6;

    // Zero line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    if (len < 2) return;

    // Plot correlation curve
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r < len; r++) {
      const px = (r / (len - 1)) * (w - 20) + 10;
      const val = corr[r];
      const py = midY - val * (h * 0.45);
      if (r === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Mark dominant peak if found
    if (wave.dominantWavelength > 0 && wave.dominantWavelength < len) {
      const peakR = wave.dominantWavelength;
      const px = (peakR / (len - 1)) * (w - 20) + 10;
      const py = midY - corr[peakR] * (h * 0.45);

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(`Peak λ = ${peakR} px`, px - 25, Math.max(14, py - 8));
    }
  }
}
