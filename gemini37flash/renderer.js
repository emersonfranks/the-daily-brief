// @ts-check
import { DensityMotilitySim } from './sim.js';

/**
 * Visual renderer for Density-Enhanced Motility and Starburst Superbubble simulations
 */
export class SimRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {DensityMotilitySim} sim
   */
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.sim = sim;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }
    this.ctx = ctx;

    /** @type {'microbial' | 'astrophysical' | 'dual'} */
    this.viewMode = 'microbial';
    this.showVectors = true;
    this.showRadialGraph = true;
    this.showPhasePortrait = true;

    /** @type {{ rho: number, v: number }[]} */
    this.phaseHistory = [];

    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 400;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.displayWidth = w;
    this.displayHeight = h;
  }

  /**
   * Render a complete frame
   */
  render() {
    const { ctx, displayWidth: w, displayHeight: h } = this;
    const { width: simW, height: simH, quorumThreshold, quorumRadius } = this.sim.config;
    const scaleX = w / simW;
    const scaleY = h / simH;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    if (this.viewMode === 'microbial') {
      bgGrad.addColorStop(0, '#0d1821');
      bgGrad.addColorStop(1, '#050a0f');
    } else {
      bgGrad.addColorStop(0, '#1c101d');
      bgGrad.addColorStop(1, '#08040a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Central trap boundary & sensing threshold field glow
    const cx = w / 2;
    const cy = h / 2;

    // Cavitation void contour
    const snap = this.sim.getSnapshot();
    const coreR = (simW * 0.25) * scaleX;
    const rimInner = (simW * 0.35) * scaleX;
    const rimOuter = (simW * 0.7) * scaleX;

    // Draw sensing zone / cavity markers
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.strokeStyle = this.viewMode === 'microbial' ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 107, 107, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, (rimInner + rimOuter) / 2, 0, Math.PI * 2);
    ctx.strokeStyle = this.viewMode === 'microbial' ? 'rgba(69, 183, 209, 0.15)' : 'rgba(255, 179, 71, 0.15)';
    ctx.setLineDash([2, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw particles
    const particles = this.sim.particles;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const px = p.x * scaleX;
      const py = p.y * scaleY;
      const isActive = p.activeLevel > 0.5;

      // Glow halo for active blast particles
      if (p.activeLevel > 0.2) {
        ctx.beginPath();
        const glowRad = (4 + p.activeLevel * 9) * scaleX;
        ctx.arc(px, py, glowRad, 0, Math.PI * 2);
        if (this.viewMode === 'microbial') {
          ctx.fillStyle = `rgba(0, 255, 200, ${p.activeLevel * 0.25})`;
        } else {
          ctx.fillStyle = `rgba(255, 90, 40, ${p.activeLevel * 0.35})`;
        }
        ctx.fill();
      }

      // Particle body
      ctx.beginPath();
      const bodyRad = isActive ? 3.5 : 2.2;
      ctx.arc(px, py, bodyRad * scaleX, 0, Math.PI * 2);

      if (this.viewMode === 'microbial') {
        if (isActive) {
          ctx.fillStyle = '#55ffbb';
        } else {
          const t = Math.min(1, p.density / quorumThreshold);
          ctx.fillStyle = `rgb(${Math.floor(40 + 100 * t)}, ${Math.floor(130 + 90 * t)}, ${Math.floor(210 - 50 * t)})`;
        }
      } else {
        if (isActive) {
          ctx.fillStyle = '#ffdd55';
        } else {
          const t = Math.min(1, p.density / quorumThreshold);
          ctx.fillStyle = `rgb(${Math.floor(180 + 70 * t)}, ${Math.floor(70 + 100 * t)}, ${Math.floor(120 - 40 * t)})`;
        }
      }
      ctx.fill();

      // Velocity vectors for active particles
      if (this.showVectors && (isActive || Math.hypot(p.vx, p.vy) > 1.5)) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.vx * 3.5 * scaleX, py + p.vy * 3.5 * scaleY);
        ctx.strokeStyle = isActive
          ? (this.viewMode === 'microbial' ? 'rgba(85, 255, 187, 0.7)' : 'rgba(255, 221, 85, 0.8)')
          : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Record phase history for phase portrait
    this.phaseHistory.push({ rho: snap.coreDensity, v: snap.meanSpeed });
    if (this.phaseHistory.length > 120) {
      this.phaseHistory.shift();
    }

    // Inset 1: Radial Density Profile Graph
    if (this.showRadialGraph) {
      this.renderRadialProfile(snap, w, h);
    }

    // Inset 2: Phase Portrait Limit Cycle
    if (this.showPhasePortrait) {
      this.renderPhasePortrait(w, h);
    }

    ctx.restore();
  }

  /**
   * Render mini inset radial density graph \rho(r)
   * @param {import('./sim.js').SimSnapshot} snap
   * @param {number} w
   * @param {number} h
   */
  renderRadialProfile(snap, w, h) {
    const { ctx } = this;
    const boxW = 120;
    const boxH = 65;
    const bx = w - boxW - 12;
    const by = 12;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px monospace';
    ctx.fillText('Radial Profile ρ(r)', bx + 6, by + 12);

    const profile = snap.radialProfile;
    const maxVal = Math.max(0.04, ...profile);

    ctx.beginPath();
    for (let i = 0; i < profile.length; i++) {
      const gx = bx + 8 + (i / (profile.length - 1)) * (boxW - 16);
      const gy = by + boxH - 6 - (profile[i] / maxVal) * (boxH - 24);
      if (i === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.strokeStyle = this.viewMode === 'microbial' ? '#4ecdc4' : '#ff7a59';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Cavitation label
    ctx.fillStyle = snap.cavitationRatio > 0.25 ? '#55ffbb' : '#8899aa';
    ctx.fillText(`Cavity: ${snap.cavitationRatio.toFixed(2)}x`, bx + 6, by + boxH - 8);

    ctx.restore();
  }

  /**
   * Render limit cycle phase trajectory (\rho_core, v_mean)
   * @param {number} w
   * @param {number} h
   */
  renderPhasePortrait(w, h) {
    const { ctx } = this;
    const boxW = 120;
    const boxH = 65;
    const bx = 12;
    const by = 12;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px monospace';
    ctx.fillText('Phase (ρ_core vs ⟨v⟩)', bx + 6, by + 12);

    if (this.phaseHistory.length > 2) {
      ctx.beginPath();
      const maxRho = 0.04;
      const maxV = 5.0;

      for (let i = 0; i < this.phaseHistory.length; i++) {
        const item = this.phaseHistory[i];
        const px = bx + 8 + (item.rho / maxRho) * (boxW - 16);
        const py = by + boxH - 8 - (item.v / maxV) * (boxH - 24);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Current head point
      const last = this.phaseHistory[this.phaseHistory.length - 1];
      const hx = bx + 8 + (last.rho / maxRho) * (boxW - 16);
      const hy = by + boxH - 8 - (last.v / maxV) * (boxH - 24);
      ctx.beginPath();
      ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    ctx.restore();
  }
}
