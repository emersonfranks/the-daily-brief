// @ts-check
import { SandpileModel } from './sandpile-model.js';

/**
 * @typedef {'sandpile' | 'neural' | 'seismic' | 'split'} RenderSkin
 */

export class SandpileRenderer {
  /**
   * @param {HTMLCanvasElement} mainCanvas
   * @param {HTMLCanvasElement} plotCanvas
   * @param {HTMLCanvasElement} distCanvas
   */
  constructor(mainCanvas, plotCanvas, distCanvas) {
    this.mainCanvas = mainCanvas;
    this.mainCtx = /** @type {CanvasRenderingContext2D} */ (mainCanvas.getContext('2d'));

    this.plotCanvas = plotCanvas;
    this.plotCtx = /** @type {CanvasRenderingContext2D} */ (plotCanvas.getContext('2d'));

    this.distCanvas = distCanvas;
    this.distCtx = /** @type {CanvasRenderingContext2D} */ (distCanvas.getContext('2d'));

    /** @type {RenderSkin} */
    this.currentSkin = 'split';

    this.imgData = this.mainCtx.createImageData(mainCanvas.width, mainCanvas.height);
  }

  /**
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
   * @param {SandpileModel} model
   * @param {Uint8Array|null} [activeTopples]
   * @param {{ brushX?: number, brushY?: number, brushRadius?: number }} [brushInfo]
   */
  renderGrid(model, activeTopples, brushInfo) {
    const size = model.size;
    this.resizeBuffer(size, size);

    const data = this.imgData.data;
    const skin = this.currentSkin;
    const halfX = Math.floor(size / 2);

    for (let y = 0; y < size; y++) {
      const rowOffset = y * size;
      for (let x = 0; x < size; x++) {
        const idx = rowOffset + x;
        const val = model.grid[idx];
        const isToppling = activeTopples ? activeTopples[idx] === 1 : false;
        const pixelIdx = idx * 4;

        let activeSkin = skin;
        if (skin === 'split') {
          activeSkin = x < halfX ? 'sandpile' : 'neural';
        }

        let r = 0, g = 0, b = 0;

        if (isToppling) {
          if (activeSkin === 'neural') {
            r = 74; g = 222; b = 128;
          } else if (activeSkin === 'seismic') {
            r = 254; g = 240; b = 138;
          } else {
            r = 255; g = 255; b = 255;
          }
        } else if (activeSkin === 'sandpile') {
          switch (val) {
            case 0: r = 15; g = 23; b = 42; break;
            case 1: r = 217; g = 119; b = 6; break;
            case 2: r = 234; g = 88; b = 12; break;
            case 3: r = 250; g = 204; b = 21; break;
            default: r = 255; g = 255; b = 255; break;
          }
        } else if (activeSkin === 'neural') {
          switch (val) {
            case 0: r = 3; g = 7; b = 18; break;
            case 1: r = 49; g = 46; b = 129; break;
            case 2: r = 99; g = 102; b = 241; break;
            case 3: r = 165; g = 180; b = 252; break;
            default: r = 74; g = 222; b = 128; break;
          }
        } else {
          switch (val) {
            case 0: r = 4; g = 47; b = 46; break;
            case 1: r = 5; g = 150; b = 105; break;
            case 2: r = 245; g = 158; b = 11; break;
            case 3: r = 239; g = 68; b = 68; break;
            default: r = 254; g = 240; b = 138; break;
          }
        }

        if (skin === 'split' && (x === halfX - 1 || x === halfX)) {
          r = 255; g = 255; b = 255;
        }

        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = 255;
      }
    }

    this.mainCtx.putImageData(this.imgData, 0, 0);

    if (brushInfo && brushInfo.brushX !== undefined && brushInfo.brushY !== undefined) {
      this.mainCtx.strokeStyle = '#38bdf8';
      this.mainCtx.lineWidth = 1.5;
      this.mainCtx.beginPath();
      this.mainCtx.arc(brushInfo.brushX, brushInfo.brushY, brushInfo.brushRadius ?? 3, 0, Math.PI * 2);
      this.mainCtx.stroke();
    }
  }

  /**
   * @param {SandpileModel} model
   */
  renderLogLogPlot(model) {
    const ctx = this.plotCtx;
    const canvas = this.plotCanvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 45;
    const padRight = 15;
    const padTop = 20;
    const padBottom = 30;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    for (let logX = 0; logX <= 4; logX++) {
      const px = padLeft + (logX / 4) * plotW;
      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`10^${logX}`, px - 10, padTop + plotH + 14);
    }

    for (let logY = -6; logY <= 0; logY += 2) {
      const py = padTop + ((0 - logY) / 6) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(padLeft + plotW, py);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`10^${logY}`, 8, py + 3);
    }

    const stats = model.getLogLogDistribution(14);
    if (stats.logBins.length < 2) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Accumulating avalanche events...', padLeft + 20, padTop + plotH / 2);
      return;
    }

    const xMin = 0;
    const xMax = 4;
    const yMin = -6;
    const yMax = 0;

    if (stats.r2 > 0.6 && Math.abs(stats.slope) > 0.1) {
      const x1 = Math.max(0, stats.logBins[0]);
      const x2 = Math.min(4, stats.logBins[stats.logBins.length - 1]);
      const intercept = stats.logCounts[0] - stats.slope * stats.logBins[0];
      const y1 = stats.slope * x1 + intercept;
      const y2 = stats.slope * x2 + intercept;

      const px1 = padLeft + ((x1 - xMin) / (xMax - xMin)) * plotW;
      const py1 = padTop + ((yMax - y1) / (yMax - yMin)) * plotH;
      const px2 = padLeft + ((x2 - xMin) / (xMax - xMin)) * plotW;
      const py2 = padTop + ((yMax - y2) / (yMax - yMin)) * plotH;

      ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px1, Math.max(padTop, Math.min(padTop + plotH, py1)));
      ctx.lineTo(px2, Math.max(padTop, Math.min(padTop + plotH, py2)));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (let i = 0; i < stats.logBins.length; i++) {
      const bx = stats.logBins[i];
      const by = stats.logCounts[i];

      const px = padLeft + ((bx - xMin) / (xMax - xMin)) * plotW;
      const py = padTop + ((yMax - by) / (yMax - yMin)) * plotH;

      if (px >= padLeft && px <= padLeft + plotW && py >= padTop && py <= padTop + plotH) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = '11px sans-serif';
    ctx.fillText(`P(S) ~ S^(-τ)`, padLeft + 10, padTop + 14);

    if (stats.r2 > 0.5) {
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`τ = ${Math.abs(stats.slope).toFixed(2)} (R² = ${stats.r2.toFixed(2)})`, padLeft + 90, padTop + 14);
    }
  }

  /**
   * @param {SandpileModel} model
   */
  renderDistribution(model) {
    const ctx = this.distCtx;
    const canvas = this.distCanvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const dist = model.getHeightDistribution();
    const totalCells = model.grid.length;
    const meanH = model.getMeanHeight();

    const colors = ['#334155', '#d97706', '#ea580c', '#facc15'];
    const barW = (w - 40) / 4;

    for (let i = 0; i < 4; i++) {
      const fraction = dist[i] / totalCells;
      const barH = fraction * (h - 35);
      const bx = 20 + i * barW;
      const by = h - 20 - barH;

      ctx.fillStyle = colors[i];
      ctx.fillRect(bx + 4, by, barW - 8, barH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`z=${i}`, bx + barW / 2 - 8, h - 6);

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${(fraction * 100).toFixed(0)}%`, bx + barW / 2 - 10, Math.max(12, by - 4));
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px sans-serif';
    ctx.fillText(`<z> = ${meanH.toFixed(3)}`, w - 75, 14);
  }
}

