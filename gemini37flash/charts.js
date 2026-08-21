// @ts-check

export class TimeSeriesChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} maxPoints
   */
  constructor(canvas, maxPoints = 200) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.maxPoints = maxPoints;
    /** @type {number[]} */
    this.data = [];
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
   * @param {number} value
   */
  push(value) {
    this.data.push(value);
    if (this.data.length > this.maxPoints) {
      this.data.shift();
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090e17';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 32;
    const padBottom = 20;
    const padTop = 10;
    const padRight = 10;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let step = 0; step <= 4; step++) {
      const yVal = step / 4;
      const yPos = padTop + chartH * (1 - yVal);
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(yVal.toFixed(2), padLeft - 6, yPos + 3);
    }

    if (this.data.length < 2) return;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.data.length; i++) {
      const x = padLeft + (i / (this.maxPoints - 1)) * chartW;
      const normalized = Math.max(0, Math.min(1, this.data[i]));
      const y = padTop + chartH * (1 - normalized);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const latest = this.data[this.data.length - 1];
    const latestY = padTop + chartH * (1 - Math.max(0, Math.min(1, latest)));
    const latestX = padLeft + ((this.data.length - 1) / (this.maxPoints - 1)) * chartW;

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(latestX, latestY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
