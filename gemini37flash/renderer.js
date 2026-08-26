// @ts-check

/**
 * @typedef {import('./stochastic-resonance.js').SweepPoint} SweepPoint
 */

export class VisualRenderer {
  /**
   * @param {HTMLCanvasElement} canvasClimate
   * @param {HTMLCanvasElement} canvasNeuron
   * @param {HTMLCanvasElement} canvasSpectrum
   */
  constructor(canvasClimate, canvasNeuron, canvasSpectrum) {
    this.canvasClimate = canvasClimate;
    this.ctxClimate = /** @type {CanvasRenderingContext2D} */ (canvasClimate.getContext('2d'));
    this.canvasNeuron = canvasNeuron;
    this.ctxNeuron = /** @type {CanvasRenderingContext2D} */ (canvasNeuron.getContext('2d'));
    this.canvasSpectrum = canvasSpectrum;
    this.ctxSpectrum = /** @type {CanvasRenderingContext2D} */ (canvasSpectrum.getContext('2d'));

    /** @type {number[]} */
    this.climateHistory = [];
    /** @type {number[]} */
    this.climateSignalHistory = [];
    /** @type {number[]} */
    this.neuronVoltageHistory = [];
    /** @type {number[]} */
    this.neuronSignalHistory = [];
    /** @type {boolean[]} */
    this.neuronSpikeHistory = [];
    this.historyLength = 320;
  }

  /**
   * @param {number} x
   * @param {number} signal
   * @param {number} v
   * @param {boolean} spiked
   */
  pushData(x, signal, v, spiked) {
    this.climateHistory.push(x);
    this.climateSignalHistory.push(signal);
    this.neuronVoltageHistory.push(v);
    this.neuronSignalHistory.push(signal);
    this.neuronSpikeHistory.push(spiked);

    if (this.climateHistory.length > this.historyLength) {
      this.climateHistory.shift();
      this.climateSignalHistory.shift();
      this.neuronVoltageHistory.shift();
      this.neuronSignalHistory.shift();
      this.neuronSpikeHistory.shift();
    }
  }

  /**
   * @param {number} currentX
   * @param {number} currentSignal
   * @param {number} noiseIntensity
   * @param {number} a
   * @param {number} b
   */
  renderClimate(currentX, currentSignal, noiseIntensity, a = 1.0, b = 1.0) {
    const w = this.canvasClimate.width;
    const h = this.canvasClimate.height;
    const ctx = this.ctxClimate;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const wellWidth = Math.floor(w * 0.42);
    const wellHeight = h;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, wellWidth, wellHeight);
    ctx.clip();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, wellWidth, wellHeight);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wellWidth / 2, 0);
    ctx.lineTo(wellWidth / 2, wellHeight);
    ctx.moveTo(0, wellHeight * 0.75);
    ctx.lineTo(wellWidth, wellHeight * 0.75);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('Glacial (Ice Age)', 12, 22);
    ctx.fillText('Interglacial (Warm)', wellWidth - 110, 22);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const scaleX = wellWidth / 4.4;
    const scaleY = wellHeight * 0.45;
    const originX = wellWidth / 2;
    const originY = wellHeight * 0.68;

    for (let px = 0; px <= wellWidth; px += 2) {
      const xVal = (px - originX) / scaleX;
      const potential = -0.5 * a * xVal * xVal + 0.25 * b * Math.pow(xVal, 4) - currentSignal * xVal;
      const py = originY - potential * scaleY;
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const ballX = originX + currentX * scaleX;
    const ballPotential = -0.5 * a * currentX * currentX + 0.25 * b * Math.pow(currentX, 4) - currentSignal * currentX;
    const ballY = originY - ballPotential * scaleY;

    ctx.beginPath();
    ctx.arc(ballX, ballY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = currentX >= 0 ? '#f59e0b' : '#0284c7';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    const chartX = wellWidth + 12;
    const chartW = w - chartX - 12;
    const chartH = h - 24;
    const chartY = 12;

    ctx.save();
    ctx.translate(chartX, chartY);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, chartW, chartH);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, chartH / 2);
    ctx.lineTo(chartW, chartH / 2);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('Climate Trajectory x(t)', 8, 16);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('100 kyr Orbital Forcing A·cos(ωt)', 8, chartH - 8);

    const n = this.climateHistory.length;
    if (n > 1) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = (i / (this.historyLength - 1)) * chartW;
        const py = chartH / 2 - this.climateSignalHistory[i] * (chartH * 1.8);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = (i / (this.historyLength - 1)) * chartW;
        const val = this.climateHistory[i];
        const py = chartH / 2 - val * (chartH * 0.35);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * @param {number} currentV
   * @param {number} vThreshold
   * @param {number} vRest
   */
  renderNeuron(currentV, vThreshold = -55, vRest = -70) {
    const w = this.canvasNeuron.width;
    const h = this.canvasNeuron.height;
    const ctx = this.ctxNeuron;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const vMin = -80;
    const vMax = 25;
    const vSpan = vMax - vMin;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 12, w - 24, h - 24);

    const chartW = w - 24;
    const chartH = h - 24;

    ctx.save();
    ctx.translate(12, 12);

    const threshY = chartH - ((vThreshold - vMin) / vSpan) * chartH;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(chartW, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Threshold (${vThreshold} mV)`, chartW - 130, threshY - 4);

    const restY = chartH - ((vRest - vMin) / vSpan) * chartH;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(0, restY);
    ctx.lineTo(chartW, restY);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Rest (${vRest} mV)`, 8, restY + 12);

    const n = this.neuronVoltageHistory.length;
    if (n > 1) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = (i / (this.historyLength - 1)) * chartW;
        const s = this.neuronSignalHistory[i];
        const py = restY - (s / 15) * (chartH * 0.2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = (i / (this.historyLength - 1)) * chartW;
        const v = this.neuronVoltageHistory[i];
        const py = chartH - ((v - vMin) / vSpan) * chartH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      for (let i = 0; i < n; i++) {
        if (this.neuronSpikeHistory[i]) {
          const px = (i / (this.historyLength - 1)) * chartW;
          ctx.beginPath();
          ctx.arc(px, 12, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /**
   * @param {SweepPoint[]} sweepData
   * @param {number} currentNoise
   * @param {number} maxNoise
   */
  renderResonanceCurve(sweepData, currentNoise, maxNoise) {
    const w = this.canvasSpectrum.width;
    const h = this.canvasSpectrum.height;
    const ctx = this.ctxSpectrum;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const padL = 40;
    const padR = 20;
    const padT = 24;
    const padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(padL, padT, plotW, plotH);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, plotW, plotH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('Signal-to-Noise Ratio (SNR dB) vs Noise Intensity', padL + 8, padT - 8);
    ctx.fillText('Noise Intensity (D)', padL + plotW / 2 - 45, h - 8);

    if (sweepData.length < 2) return;

    let maxSNR = 1;
    for (const pt of sweepData) {
      if (pt.snr > maxSNR) maxSNR = pt.snr;
    }
    maxSNR = Math.ceil(maxSNR * 1.15);

    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    for (let s = 0; s <= maxSNR; s += 5) {
      const py = padT + plotH - (s / maxSNR) * plotH;
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.fillText(`${s}`, 12, py + 4);
    }
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < sweepData.length; i++) {
      const pt = sweepData[i];
      const px = padL + (pt.noise / maxNoise) * plotW;
      const py = padT + plotH - (Math.max(0, pt.snr) / maxSNR) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    for (let i = 0; i < sweepData.length; i++) {
      const pt = sweepData[i];
      const px = padL + (pt.noise / maxNoise) * plotW;
      const py = padT + plotH - (Math.max(0, pt.snr) / maxSNR) * plotH;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    const currentPx = padL + (Math.min(currentNoise, maxNoise) / maxNoise) * plotW;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(currentPx, padT);
    ctx.lineTo(currentPx, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`Current D = ${currentNoise.toFixed(3)}`, currentPx + 6, padT + 16);
  }
}
