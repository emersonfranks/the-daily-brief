// @ts-check
import { KuramotoModel } from './kuramoto-model.js';

export class SimulationRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {KuramotoModel} model
   */
  constructor(canvas, model) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.model = model;
    this.viewMode = 'fireflies';
    this.width = canvas.width;
    this.height = canvas.height;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * @param {string} mode
   */
  setViewMode(mode) {
    this.viewMode = mode;
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    if (this.viewMode === 'fireflies') {
      this.renderFireflies(ctx, w, h);
    } else if (this.viewMode === 'grid') {
      this.renderPowerGrid(ctx, w, h);
    } else {
      this.renderPhasorWheel(ctx, w, h);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  renderFireflies(ctx, w, h) {
    const bgGradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    bgGradient.addColorStop(0, '#0a1324');
    bgGradient.addColorStop(1, '#030712');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    const padding = 40;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

    const metrics = this.model.getMetrics();

    if (metrics.orderParameter > 0.4) {
      const ambientAlpha = Math.max(0, (metrics.orderParameter - 0.4) * 0.4 * Math.max(0, Math.cos(metrics.meanPhase)));
      if (ambientAlpha > 0.01) {
        ctx.fillStyle = `rgba(234, 179, 8, ${ambientAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    const oscillators = this.model.oscillators;
    for (let i = 0; i < oscillators.length; i++) {
      const osc = oscillators[i];
      const px = padding + osc.x * drawW;
      const py = padding + osc.y * drawH;

      const phase = osc.theta;
      const intensity = Math.pow(Math.max(0, Math.cos(phase)), 6);

      const glowRadius = 6 + intensity * 32;
      const glow = ctx.createRadialGradient(px, py, 1, px, py, glowRadius);
      glow.addColorStop(0, `rgba(254, 240, 138, ${Math.min(1, 0.4 + intensity * 0.6).toFixed(2)})`);
      glow.addColorStop(0.3, `rgba(234, 179, 8, ${(intensity * 0.8).toFixed(2)})`);
      glow.addColorStop(1, 'rgba(234, 179, 8, 0)');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = intensity > 0.3 ? '#fef08a' : '#64748b';
      ctx.beginPath();
      ctx.arc(px, py, 2.5 + intensity * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  renderPowerGrid(ctx, w, h) {
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, w, h);

    const padding = 50;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

    const links = this.model.links;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const o1 = this.model.oscillators[link.source];
      const o2 = this.model.oscillators[link.target];

      const x1 = padding + o1.x * drawW;
      const y1 = padding + o1.y * drawH;
      const x2 = padding + o2.x * drawW;
      const y2 = padding + o2.y * drawH;

      const flow = Math.abs(link.powerFlow);
      const flowNormalized = Math.min(1, flow * 2.5);

      ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.08, flowNormalized * 0.8).toFixed(2)})`;
      ctx.lineWidth = 1 + flowNormalized * 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (flowNormalized > 0.2) {
        const t = (this.model.time * 2 + i * 0.2) % 1;
        const mx = x1 + (x2 - x1) * t;
        const my = y1 + (y2 - y1) * t;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const oscillators = this.model.oscillators;
    for (let i = 0; i < oscillators.length; i++) {
      const osc = oscillators[i];
      const px = padding + osc.x * drawW;
      const py = padding + osc.y * drawH;

      const phase = osc.theta;
      const needleX = px + Math.cos(phase) * 16;
      const needleY = py + Math.sin(phase) * 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const dev = Math.abs(osc.instantaneousFrequency - this.model.baseFreq);
      const statusColor = dev < 0.1 ? '#10b981' : dev < 0.4 ? '#f59e0b' : '#ef4444';

      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(needleX, needleY);
      ctx.stroke();

      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  renderPhasorWheel(ctx, w, h) {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    const centerX = w * 0.5;
    const centerY = h * 0.5;
    const radius = Math.min(w, h) * 0.38;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius - 15, centerY);
    ctx.lineTo(centerX + radius + 15, centerY);
    ctx.moveTo(centerX, centerY - radius - 15);
    ctx.lineTo(centerX, centerY + radius + 15);
    ctx.stroke();

    const oscillators = this.model.oscillators;
    for (let i = 0; i < oscillators.length; i++) {
      const osc = oscillators[i];
      const ox = centerX + Math.cos(osc.theta) * radius;
      const oy = centerY + Math.sin(osc.theta) * radius;

      ctx.fillStyle = 'rgba(96, 165, 250, 0.7)';
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const metrics = this.model.getMetrics();
    const orderR = metrics.orderParameter;
    const orderPsi = metrics.meanPhase;
    const arrowLen = orderR * radius;
    const arrowX = centerX + Math.cos(orderPsi) * arrowLen;
    const arrowY = centerY + Math.sin(orderPsi) * arrowLen;

    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(arrowX, arrowY, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`r = ${orderR.toFixed(3)}`, 20, 30);
    ctx.fillText(`ψ = ${orderPsi.toFixed(2)} rad`, 20, 50);
  }
}
