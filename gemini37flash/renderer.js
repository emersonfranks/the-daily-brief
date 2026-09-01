// @ts-check
import { DoubleDiffusiveSim } from './simulation.js';

/**
 * Renderer for Double-Diffusive Convection Simulation
 */
export class SimRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {DoubleDiffusiveSim} sim
   */
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.sim = sim;

    this.viewMode = 'composition'; // 'composition', 'temperature', 'vorticity', 'density'
    this.domainTheme = 'ocean'; // 'ocean' or 'whitedwarf'
    this.showParticles = true;
    this.showVelocityField = false;

    // Off-screen canvas for rendering fluid grid
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = sim.nx;
    this.offscreen.height = sim.ny;
    this.offCtx = /** @type {CanvasRenderingContext2D} */ (this.offscreen.getContext('2d'));
    this.imgData = this.offCtx.createImageData(sim.nx, sim.ny);

    this.probeX = -1;
    this.probeY = -1;
  }

  /**
   * Update the simulation instance if re-initialized
   * @param {DoubleDiffusiveSim} newSim
   */
  setSimulation(newSim) {
    this.sim = newSim;
    if (this.offscreen.width !== newSim.nx || this.offscreen.height !== newSim.ny) {
      this.offscreen.width = newSim.nx;
      this.offscreen.height = newSim.ny;
      this.imgData = this.offCtx.createImageData(newSim.nx, newSim.ny);
    }
  }

  /**
   * Set display colormap mode
   * @param {'composition' | 'temperature' | 'vorticity' | 'density'} mode
   */
  setViewMode(mode) {
    this.viewMode = mode;
  }

  /**
   * Set theme (affects composition colormap labels and palette)
   * @param {'ocean' | 'whitedwarf'} theme
   */
  setDomainTheme(theme) {
    this.domainTheme = theme;
  }

  /**
   * Interpolate RGB values
   * @param {number[]} c1
   * @param {number[]} c2
   * @param {number} t
   * @returns {number[]}
   */
  lerpColor(c1, c2, t) {
    const clamped = Math.max(0, Math.min(1, t));
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * clamped),
      Math.round(c1[1] + (c2[1] - c1[1]) * clamped),
      Math.round(c1[2] + (c2[2] - c1[2]) * clamped)
    ];
  }

  /**
   * Get RGBA color for scalar value based on current viewMode
   * @param {number} sVal
   * @param {number} tVal
   * @param {number} wVal
   * @param {number} rhoVal
   * @returns {[number, number, number, number]}
   */
  getColor(sVal, tVal, wVal, rhoVal) {
    if (this.viewMode === 'composition') {
      if (this.domainTheme === 'whitedwarf') {
        // White Dwarf: Heavy Metals (Iron/Silicon) Plume palette (Dark violet -> Ember gold -> Superheated white)
        const darkViolet = [15, 8, 30];
        const deepMagenta = [120, 28, 90];
        const flameGold = [245, 158, 11];
        const stellarWhite = [255, 250, 230];

        let rgb;
        if (sVal < 0.4) {
          rgb = this.lerpColor(darkViolet, deepMagenta, sVal / 0.4);
        } else if (sVal < 0.75) {
          rgb = this.lerpColor(deepMagenta, flameGold, (sVal - 0.4) / 0.35);
        } else {
          rgb = this.lerpColor(flameGold, stellarWhite, (sVal - 0.75) / 0.25);
        }
        return [rgb[0], rgb[1], rgb[2], 255];
      } else {
        // Ocean: High Salinity vs Fresh Water (Abyssal dark navy -> Turquoise -> Salt white)
        const abyssNavy = [8, 18, 38];
        const marineTeal = [14, 116, 144];
        const cyanSalt = [56, 189, 248];
        const whiteSalt = [240, 253, 255];

        let rgb;
        if (sVal < 0.35) {
          rgb = this.lerpColor(abyssNavy, marineTeal, sVal / 0.35);
        } else if (sVal < 0.75) {
          rgb = this.lerpColor(marineTeal, cyanSalt, (sVal - 0.35) / 0.4);
        } else {
          rgb = this.lerpColor(cyanSalt, whiteSalt, (sVal - 0.75) / 0.25);
        }
        return [rgb[0], rgb[1], rgb[2], 255];
      }
    } else if (this.viewMode === 'temperature') {
      // Temperature: Cold indigo (0.0) -> Crimson hot (1.0)
      const coldIndigo = [15, 23, 42];
      const warmOrange = [234, 88, 12];
      const hotCrimson = [244, 63, 94];
      const whiteHot = [255, 241, 242];

      let rgb;
      if (tVal < 0.5) {
        rgb = this.lerpColor(coldIndigo, warmOrange, tVal * 2);
      } else if (tVal < 0.85) {
        rgb = this.lerpColor(warmOrange, hotCrimson, (tVal - 0.5) / 0.35);
      } else {
        rgb = this.lerpColor(hotCrimson, whiteHot, (tVal - 0.85) / 0.15);
      }
      return [rgb[0], rgb[1], rgb[2], 255];
    } else if (this.viewMode === 'vorticity') {
      // Vorticity: Clockwise (Blue) <-> Zero (Dark) <-> Counter-Clockwise (Amber)
      const maxW = 50.0;
      const normW = Math.max(-1, Math.min(1, wVal / maxW));
      const darkBg = [15, 23, 42];
      const blueVortex = [37, 99, 235];
      const amberVortex = [245, 158, 11];

      let rgb;
      if (normW < 0) {
        rgb = this.lerpColor(darkBg, blueVortex, -normW);
      } else {
        rgb = this.lerpColor(darkBg, amberVortex, normW);
      }
      return [rgb[0], rgb[1], rgb[2], 255];
    } else {
      // Density deviation: deltaRho = (1/R_rho)*S - T
      // Light / Buoyant (negative) -> Emerald / Cyan, Heavy / Sinking (positive) -> Crimson / Purple
      const normRho = Math.max(-1, Math.min(1, rhoVal * 2.0));
      const neutral = [20, 24, 39];
      const lightParcels = [16, 185, 129];
      const denseParcels = [225, 29, 72];

      let rgb;
      if (normRho < 0) {
        rgb = this.lerpColor(neutral, lightParcels, -normRho);
      } else {
        rgb = this.lerpColor(neutral, denseParcels, normRho);
      }
      return [rgb[0], rgb[1], rgb[2], 255];
    }
  }

  /**
   * Render the fluid grid, particles, velocity vectors, and probe overlay
   */
  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;
    const sim = this.sim;

    const nx = sim.nx;
    const ny = sim.ny;
    const data = this.imgData.data;

    const invRrho = sim.rRho > 0 ? (1.0 / sim.rRho) : 1.0;

    // 1. Build pixel buffer
    let ptr = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        const s = sim.S[idx];
        const t = sim.T[idx];
        const w = sim.omega[idx];
        const rho = invRrho * s - t;

        const [r, g, b, a] = this.getColor(s, t, w, rho);
        data[ptr] = r;
        data[ptr + 1] = g;
        data[ptr + 2] = b;
        data[ptr + 3] = a;
        ptr += 4;
      }
    }

    // 2. Blit offscreen pixel buffer to canvas with smooth filtering
    this.offCtx.putImageData(this.imgData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.offscreen, 0, 0, width, height);

    // 3. Render Tracer Particles
    if (this.showParticles) {
      for (let p = 0; p < sim.numParticles; p++) {
        const base = p * 4;
        const px = (sim.particles[base] / sim.lx) * width;
        const py = (sim.particles[base + 1] / sim.ly) * height;
        const type = sim.particles[base + 3];

        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, 2 * Math.PI);
        if (type === 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        }
        ctx.fill();
      }
    }

    // 4. Render Velocity Vectors if enabled
    if (this.showVelocityField) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      const stepGrid = Math.max(2, Math.floor(nx / 16));
      for (let j = stepGrid; j < ny - 1; j += stepGrid) {
        const py = (j / (ny - 1)) * height;
        for (let i = 0; i < nx; i += stepGrid) {
          const px = (i / nx) * width;
          const idx = j * nx + i;
          const uVal = sim.u[idx];
          const vVal = sim.v[idx];

          const len = Math.sqrt(uVal * uVal + vVal * vVal);
          if (len > 0.05) {
            const scale = Math.min(18, len * 0.4);
            const dirX = (uVal / len) * scale;
            const dirY = (vVal / len) * scale;

            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + dirX, py + dirY);
            ctx.stroke();
          }
        }
      }
    }

    // 5. Render Probe Marker & Overlay
    if (this.probeX >= 0 && this.probeY >= 0 && this.probeX <= width && this.probeY <= height) {
      const normX = this.probeX / width;
      const normY = this.probeY / height;

      const gi = Math.floor(normX * nx) % nx;
      const gj = Math.max(0, Math.min(ny - 1, Math.floor(normY * ny)));
      const idx = gj * nx + gi;

      const tVal = sim.T[idx];
      const sVal = sim.S[idx];
      const rhoVal = invRrho * sVal - tVal;
      const uVal = sim.u[idx];
      const vVal = sim.v[idx];

      // Draw crosshair
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.probeX, this.probeY, 8, 0, 2 * Math.PI);
      ctx.stroke();

      // Tooltip box
      const boxW = 160;
      const boxH = 88;
      let bx = this.probeX + 15;
      let by = this.probeY + 15;
      if (bx + boxW > width) bx = this.probeX - boxW - 15;
      if (by + boxH > height) by = this.probeY - boxH - 15;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '11px sans-serif';
      const labelS = this.domainTheme === 'whitedwarf' ? 'Heavy Metals (S)' : 'Salinity (S)';
      ctx.fillText(`${labelS}: ${sVal.toFixed(3)}`, bx + 10, by + 18);
      ctx.fillText(`Temperature (T): ${tVal.toFixed(3)}`, bx + 10, by + 34);
      ctx.fillText(`Net Density Deviation: ${rhoVal > 0 ? '+' : ''}${rhoVal.toFixed(3)}`, bx + 10, by + 50);
      ctx.fillText(`Velocity (u, v): (${uVal.toFixed(1)}, ${vVal.toFixed(1)})`, bx + 10, by + 66);
      const buoyancyDesc = rhoVal > 0.01 ? '▼ Sinking Finger' : (rhoVal < -0.01 ? '▲ Rising Plume' : '— Neutral');
      ctx.fillStyle = rhoVal > 0.01 ? '#f87171' : (rhoVal < -0.01 ? '#34d399' : '#94a3b8');
      ctx.fillText(`State: ${buoyancyDesc}`, bx + 10, by + 80);
    }

    ctx.restore();
  }

  /**
   * Render side-by-side vertical profile graphs on a separate small canvas
   * @param {HTMLCanvasElement} profileCanvas
   */
  renderProfiles(profileCanvas) {
    const ctx = /** @type {CanvasRenderingContext2D} */ (profileCanvas.getContext('2d'));
    const w = profileCanvas.width;
    const h = profileCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const profiles = this.sim.getVerticalProfiles();
    const ny = profiles.tProfile.length;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const gx = (g / 4) * w;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    // Function to draw profile curve
    /**
     * @param {number[]} arr
     * @param {string} color
     * @param {number} minVal
     * @param {number} maxVal
     */
    const drawCurve = (arr, color, minVal, maxVal) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j < ny; j++) {
        const y = (j / (ny - 1)) * (h - 20) + 10;
        const normVal = (arr[j] - minVal) / (maxVal - minVal);
        const x = Math.max(10, Math.min(w - 10, 10 + normVal * (w - 20)));
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Draw Temperature Profile (Red/Amber)
    drawCurve(profiles.tProfile, '#f87171', 0, 1);

    // Draw Composition Profile (Cyan / Gold)
    const sColor = this.domainTheme === 'whitedwarf' ? '#fbbf24' : '#38bdf8';
    drawCurve(profiles.sProfile, sColor, 0, 1);

    // Draw Density Deviation Profile (Green)
    drawCurve(profiles.rhoProfile, '#34d399', -0.5, 0.5);

    // Legend
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText('— T(z)', 10, h - 6);
    ctx.fillStyle = sColor;
    ctx.fillText('— S(z)', 55, h - 6);
    ctx.fillStyle = '#34d399';
    ctx.fillText('— ρ(z)', 100, h - 6);
  }
}
