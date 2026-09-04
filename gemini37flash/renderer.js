// @ts-check

/**
 * @fileoverview Canvas visualizer for active colloidal particles and ecological spatial dual.
 * High-performance 2D canvas rendering with vector arrows, trails, and phase plots.
 */

/**
 * @typedef {import('./simulation.js').NonreciprocalSimulation} NonreciprocalSimulation
 * @typedef {import('./ecological-dual.js').EcologicalDualSimulation} EcologicalDualSimulation
 */

export class SimRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.dpr = window.devicePixelRatio || 1;
    this.trails = true;
    this.showVectors = true;
    this.showClusters = true;

    this.setupResolution();
  }

  setupResolution() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 600;

    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = w;
    this.height = h;
  }

  /**
   * Render the active colloidal suspension.
   * @param {NonreciprocalSimulation} sim
   * @param {string} [theme='colloid'] - 'colloid' | 'ecological'
   */
  renderColloids(sim, theme = 'colloid') {
    const ctx = this.ctx;
    const { width: simW, height: simH } = sim.config;
    const scaleX = this.width / simW;
    const scaleY = this.height / simH;

    // Semi-transparent fade for kinetic motion trails
    if (this.trails) {
      ctx.fillStyle = 'rgba(10, 14, 23, 0.25)';
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Grid lines for spatial reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const step = 50 * scaleX;
    for (let x = 0; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Render particles
    const particles = sim.particles;
    const n = particles.length;

    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const px = p.x * scaleX;
      const py = p.y * scaleY;
      const r = p.radius * scaleX;

      const isA = p.type === 0;

      // Color scheme based on domain mode
      let fillColor, glowColor, strokeColor;
      if (theme === 'colloid') {
        // Active matter: Species A = Chaser (Amber/Coral), Species B = Target (Cyan/Teal)
        fillColor = isA ? '#ff7a45' : '#13c2c2';
        glowColor = isA ? 'rgba(255, 122, 69, 0.4)' : 'rgba(19, 194, 194, 0.4)';
        strokeColor = isA ? '#ffa39e' : '#87e8de';
      } else {
        // Ecological dual: Species A = Predator (Crimson), Species B = Prey (Emerald)
        fillColor = isA ? '#f5222d' : '#52c41a';
        glowColor = isA ? 'rgba(245, 34, 45, 0.4)' : 'rgba(82, 196, 26, 0.4)';
        strokeColor = isA ? '#ff7875' : '#b7eb8f';
      }

      // Draw particle body
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isA ? 8 : 12;
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      ctx.restore();

      // Velocity vectors
      if (this.showVectors) {
        const vx = p.vx * 3.5 * scaleX;
        const vy = p.vy * 3.5 * scaleY;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 1.0) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + vx, py + vy);
          ctx.strokeStyle = isA ? 'rgba(255, 150, 100, 0.6)' : 'rgba(100, 230, 230, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    // Draw cluster bounding hulls / centers if enabled
    if (this.showClusters) {
      // Find cluster centroids
      /** @type {Map<number, { count: number, x: number, y: number }>} */
      const clusterCenters = new Map();
      for (const p of particles) {
        if (p.clusterId >= 0) {
          const entry = clusterCenters.get(p.clusterId) || { count: 0, x: 0, y: 0 };
          entry.count++;
          entry.x += p.x;
          entry.y += p.y;
          clusterCenters.set(p.clusterId, entry);
        }
      }

      ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      for (const [_, entry] of clusterCenters) {
        if (entry.count >= 4) {
          const cx = (entry.x / entry.count) * scaleX;
          const cy = (entry.y / entry.count) * scaleY;
          const radius = Math.sqrt(entry.count) * 12 * scaleX;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
  }

  /**
   * Render the ecological reaction-diffusion-taxis spatial field.
   * @param {EcologicalDualSimulation} eco
   */
  renderEcologicalField(eco) {
    const ctx = this.ctx;
    const N = eco.N;
    const cellW = this.width / N;
    const cellH = this.height / N;

    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, this.width, this.height);

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const idx = y * N + x;
        const u = eco.prey[idx];      // Prey density (Green channel)
        const v = eco.predator[idx];  // Predator density (Red channel)

        const r = Math.min(255, Math.floor(v * 200));
        const g = Math.min(255, Math.floor(u * 220));
        const b = Math.min(255, Math.floor(Math.abs(u - v) * 100));

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }
}
