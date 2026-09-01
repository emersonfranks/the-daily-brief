// @ts-check

/**
 * Double-Diffusive Convection Simulation Engine
 *
 * Implements a 2D Boussinesq two-component fluid solver:
 * - Temperature field T(x, y) [fast diffuser, thermal diffusivity kappa_T = 1.0]
 * - Salinity / Exoplanetary Heavy-Metal Composition field S(x, y) [slow diffuser, kappa_S = tau * kappa_T]
 * - Vorticity-Streamfunction Navier-Stokes fluid dynamics:
 *     d(omega)/dt + (u . grad)omega = Pr * laplacian(omega) + Pr * Ra_T * ( (1/R_rho)*dS/dx - dT/dx )
 *     laplacian(psi) = -omega
 *     u = d(psi)/dy,  v = -d(psi)/dx
 *     dT/dt + (u . grad)T = laplacian(T)
 *     dS/dt + (u . grad)S = tau * laplacian(S)
 *
 * Pure domain module: no DOM, no document, fully headless and testable.
 */

export class DoubleDiffusiveSim {
  /**
   * @param {Object} [options]
   * @param {number} [options.nx=64] - Grid columns
   * @param {number} [options.ny=64] - Grid rows
   * @param {number} [options.lx=1.0] - Non-dimensional width
   * @param {number} [options.ly=1.0] - Non-dimensional height
   * @param {number} [options.raT=30000] - Thermal Rayleigh number Ra_T
   * @param {number} [options.rRho=1.5] - Density ratio R_rho = (alpha * grad T) / (beta * grad S)
   * @param {number} [options.tau=0.03] - Diffusivity ratio tau = kappa_S / kappa_T (<< 1)
   * @param {number} [options.prandtl=2.0] - Prandtl number Pr = nu / kappa_T
   * @param {number} [options.seed=42] - Deterministic PRNG seed
   */
  constructor(options = {}) {
    this.nx = options.nx || 64;
    this.ny = options.ny || 64;
    this.lx = options.lx || 1.0;
    this.ly = options.ly || 1.0;

    this.dx = this.lx / this.nx;
    this.dy = this.ly / this.ny;

    this.raT = options.raT !== undefined ? options.raT : 30000;
    this.rRho = options.rRho !== undefined ? options.rRho : 1.5;
    this.tau = options.tau !== undefined ? options.tau : 0.03;
    this.prandtl = options.prandtl !== undefined ? options.prandtl : 2.0;

    this.kappaT = 1.0;
    this.kappaS = this.tau * this.kappaT;
    this.nu = this.prandtl * this.kappaT;

    this.time = 0;
    this.stepCount = 0;
    this.rngSeed = options.seed !== undefined ? options.seed : 42;

    const size = this.nx * this.ny;
    this.T = new Float64Array(size);
    this.S = new Float64Array(size);
    this.omega = new Float64Array(size);
    this.psi = new Float64Array(size);
    this.u = new Float64Array(size);
    this.v = new Float64Array(size);

    this.T_next = new Float64Array(size);
    this.S_next = new Float64Array(size);
    this.omega_next = new Float64Array(size);

    // Tracer particles
    this.numParticles = 400;
    this.particles = new Float32Array(this.numParticles * 4); // [x, y, age, type]
    this.initParticles();

    this.initFields();
  }

  /**
   * Deterministic Linear Congruential PRNG
   * @returns {number} Float in [0, 1)
   */
  random() {
    this.rngSeed = (this.rngSeed * 1664525 + 1013904223) >>> 0;
    return this.rngSeed / 4294967296;
  }

  /**
   * Initialize fluid field stratification with sinusoidal + random perturbations
   */
  initFields() {
    this.time = 0;
    this.stepCount = 0;
    this.omega.fill(0);
    this.psi.fill(0);
    this.u.fill(0);
    this.v.fill(0);

    for (let j = 0; j < this.ny; j++) {
      const yNorm = 1.0 - j / (this.ny - 1); // 1 at top (j=0), 0 at bottom (j=ny-1)
      for (let i = 0; i < this.nx; i++) {
        const idx = j * this.nx + i;
        const xNorm = i / this.nx;

        // Linear base profiles
        this.T[idx] = yNorm;

        // Multi-mode small initial perturbation in composition to seed fingers across spectrum
        const wave = 0.015 * Math.sin(4 * Math.PI * xNorm) * Math.sin(Math.PI * yNorm)
                   + 0.010 * Math.sin(10 * Math.PI * xNorm) * Math.sin(Math.PI * yNorm)
                   + 0.005 * (this.random() - 0.5) * Math.sin(Math.PI * yNorm);

        this.S[idx] = Math.max(0.0, Math.min(1.0, yNorm + wave));
      }
    }
  }

  /**
   * Initialize / reset tracer particles
   */
  initParticles() {
    for (let i = 0; i < this.numParticles; i++) {
      const base = i * 4;
      this.particles[base] = this.random() * this.lx;
      this.particles[base + 1] = this.random() * this.ly;
      this.particles[base + 2] = this.random() * 100; // age
      this.particles[base + 3] = this.random() > 0.5 ? 1 : 0; // 1 = heavy tracer, 0 = thermal tracer
    }
  }

  /**
   * Update physical parameters
   * @param {Object} params
   */
  setParameters(params) {
    if (params.rRho !== undefined) this.rRho = params.rRho;
    if (params.tau !== undefined) this.tau = params.tau;
    if (params.raT !== undefined) this.raT = params.raT;
    if (params.prandtl !== undefined) this.prandtl = params.prandtl;

    this.kappaS = this.tau * this.kappaT;
    this.nu = this.prandtl * this.kappaT;
  }

  /**
   * Inject a localized plume or drop of solute/metals
   * @param {number} normX Normalized x in [0, 1]
   * @param {number} normY Normalized y in [0, 1]
   * @param {number} radius Normalized radius
   * @param {number} amount Solute concentration increment
   */
  injectSolute(normX, normY, radius = 0.08, amount = 0.5) {
    const r2 = radius * radius;
    for (let j = 0; j < this.ny; j++) {
      const yNorm = j / (this.ny - 1);
      const dy = yNorm - normY;
      for (let i = 0; i < this.nx; i++) {
        const xNorm = i / this.nx;
        let dx = Math.abs(xNorm - normX);
        if (dx > 0.5) dx = 1.0 - dx;

        const distSq = dx * dx + dy * dy;
        if (distSq < r2) {
          const idx = j * this.nx + i;
          const factor = Math.exp(-distSq / (2 * (radius * 0.5) * (radius * 0.5)));
          this.S[idx] = Math.min(1.0, this.S[idx] + amount * factor);
        }
      }
    }
  }

  /**
   * Apply an interactive stir / vortex perturbation
   * @param {number} normX
   * @param {number} normY
   * @param {number} strength
   */
  stir(normX, normY, strength = 50.0) {
    const radius = 0.1;
    const r2 = radius * radius;
    for (let j = 1; j < this.ny - 1; j++) {
      const yNorm = j / (this.ny - 1);
      const dy = yNorm - normY;
      for (let i = 0; i < this.nx; i++) {
        const xNorm = i / this.nx;
        let dx = Math.abs(xNorm - normX);
        if (dx > 0.5) dx = 1.0 - dx;

        const distSq = dx * dx + dy * dy;
        if (distSq < r2) {
          const idx = j * this.nx + i;
          const factor = Math.exp(-distSq / (2 * 0.05 * 0.05));
          this.omega[idx] += strength * factor;
        }
      }
    }
  }

  /**
   * Solve Poisson equation laplacian(psi) = -omega
   * Red-Black Gauss-Seidel with periodic X and Dirichlet psi=0 on top/bottom Y boundaries.
   * @param {number} maxIters
   * @param {number} tolerance
   */
  solveStreamfunction(maxIters = 60, tolerance = 1e-4) {
    const nx = this.nx;
    const ny = this.ny;
    const dx2 = this.dx * this.dx;
    const dy2 = this.dy * this.dy;
    const factor = 1.0 / (2.0 / dx2 + 2.0 / dy2);

    for (let iter = 0; iter < maxIters; iter++) {
      let maxDiff = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 0; i < nx; i++) {
            if ((i + j) % 2 !== pass) continue;

            const idx = j * nx + i;
            const left = j * nx + ((i - 1 + nx) % nx);
            const right = j * nx + ((i + 1) % nx);
            const up = (j - 1) * nx + i;
            const down = (j + 1) * nx + i;

            const newPsi = factor * (
              (this.psi[left] + this.psi[right]) / dx2 +
              (this.psi[up] + this.psi[down]) / dy2 +
              this.omega[idx]
            );

            const diff = Math.abs(newPsi - this.psi[idx]);
            if (diff > maxDiff) maxDiff = diff;
            this.psi[idx] = newPsi;
          }
        }
      }
      if (maxDiff < tolerance) break;
    }

    // Velocity field u = dpsi/dy, v = -dpsi/dx
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        const left = j * nx + ((i - 1 + nx) % nx);
        const right = j * nx + ((i + 1) % nx);

        if (j === 0) {
          const down = (j + 1) * nx + i;
          this.u[idx] = (this.psi[down] - this.psi[idx]) / this.dy;
        } else if (j === ny - 1) {
          const up = (j - 1) * nx + i;
          this.u[idx] = (this.psi[idx] - this.psi[up]) / this.dy;
        } else {
          const up = (j - 1) * nx + i;
          const down = (j + 1) * nx + i;
          this.u[idx] = (this.psi[down] - this.psi[up]) / (2.0 * this.dy);
        }

        this.v[idx] = -(this.psi[right] - this.psi[left]) / (2.0 * this.dx);
      }
    }
  }

  /**
   * Internal single sub-step of the physical PDE
   * @param {number} dt
   */
  subStep(dt) {
    const nx = this.nx;
    const ny = this.ny;
    const dx = this.dx;
    const dy = this.dy;
    const dx2 = dx * dx;
    const dy2 = dy * dy;

    this.solveStreamfunction(40, 1e-4);

    const buoyancyScale = this.prandtl * this.raT;
    const invRrho = this.rRho > 0 ? (1.0 / this.rRho) : 1.0;

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        const left = j * nx + ((i - 1 + nx) % nx);
        const right = j * nx + ((i + 1) % nx);
        const up = (j - 1) * nx + i;
        const down = (j + 1) * nx + i;

        const uVal = this.u[idx];
        const vVal = this.v[idx];

        // 1. Upwind Advection for T
        let advT_x = 0;
        if (uVal > 0) advT_x = uVal * (this.T[idx] - this.T[left]) / dx;
        else if (uVal < 0) advT_x = uVal * (this.T[right] - this.T[idx]) / dx;

        let advT_y = 0;
        if (vVal > 0) advT_y = vVal * (this.T[idx] - this.T[up]) / dy;
        else if (vVal < 0) advT_y = vVal * (this.T[down] - this.T[idx]) / dy;

        // 2. Upwind Advection for S
        let advS_x = 0;
        if (uVal > 0) advS_x = uVal * (this.S[idx] - this.S[left]) / dx;
        else if (uVal < 0) advS_x = uVal * (this.S[right] - this.S[idx]) / dx;

        let advS_y = 0;
        if (vVal > 0) advS_y = vVal * (this.S[idx] - this.S[up]) / dy;
        else if (vVal < 0) advS_y = vVal * (this.S[down] - this.S[idx]) / dy;

        // 3. Upwind Advection for omega
        let advW_x = 0;
        if (uVal > 0) advW_x = uVal * (this.omega[idx] - this.omega[left]) / dx;
        else if (uVal < 0) advW_x = uVal * (this.omega[right] - this.omega[idx]) / dx;

        let advW_y = 0;
        if (vVal > 0) advW_y = vVal * (this.omega[idx] - this.omega[up]) / dy;
        else if (vVal < 0) advW_y = vVal * (this.omega[down] - this.omega[idx]) / dy;

        // Laplacians
        const lapT = (this.T[left] + this.T[right] - 2 * this.T[idx]) / dx2 +
                     (this.T[up] + this.T[down] - 2 * this.T[idx]) / dy2;

        const lapS = (this.S[left] + this.S[right] - 2 * this.S[idx]) / dx2 +
                     (this.S[up] + this.S[down] - 2 * this.S[idx]) / dy2;

        const lapOmega = (this.omega[left] + this.omega[right] - 2 * this.omega[idx]) / dx2 +
                         (this.omega[up] + this.omega[down] - 2 * this.omega[idx]) / dy2;

        // Buoyancy torque: Pr * Ra_T * ( (1/R_rho)*dS/dx - dT/dx )
        const dSdx = (this.S[right] - this.S[left]) / (2.0 * dx);
        const dTdx = (this.T[right] - this.T[left]) / (2.0 * dx);
        const buoyancyTorque = buoyancyScale * (invRrho * dSdx - dTdx);

        this.T_next[idx] = this.T[idx] + dt * (-(advT_x + advT_y) + this.kappaT * lapT);
        this.S_next[idx] = this.S[idx] + dt * (-(advS_x + advS_y) + this.kappaS * lapS);
        this.omega_next[idx] = this.omega[idx] + dt * (-(advW_x + advW_y) + this.nu * lapOmega + buoyancyTorque);

        this.T_next[idx] = Math.max(0.0, Math.min(1.0, this.T_next[idx]));
        this.S_next[idx] = Math.max(0.0, Math.min(1.0, this.S_next[idx]));
      }
    }

    for (let i = 0; i < nx; i++) {
      const topIdx = i;
      const btmIdx = (ny - 1) * nx + i;

      this.T_next[topIdx] = 1.0;
      this.S_next[topIdx] = 1.0;
      this.omega_next[topIdx] = 0.0;

      this.T_next[btmIdx] = 0.0;
      this.S_next[btmIdx] = 0.0;
      this.omega_next[btmIdx] = 0.0;
    }

    this.T.set(this.T_next);
    this.S.set(this.S_next);
    this.omega.set(this.omega_next);

    this.time += dt;
    this.stepCount++;
  }

  /**
   * Step simulation forward by dtTotal, automatically sub-stepping for CFL and diffusive stability
   * @param {number} [dtTotal=0.0005]
   */
  step(dtTotal = 0.0005) {
    const maxDiffusivity = Math.max(this.kappaT, this.nu);
    const minGrid = Math.min(this.dx, this.dy);
    const maxDiffDt = 0.20 * (minGrid * minGrid) / maxDiffusivity;

    let maxV = 1.0;
    const n = this.nx * this.ny;
    for (let i = 0; i < n; i++) {
      const speed = Math.abs(this.u[i]) + Math.abs(this.v[i]);
      if (speed > maxV) maxV = speed;
    }
    const maxAdvectDt = 0.30 * minGrid / maxV;

    const dtSub = Math.max(1e-6, Math.min(maxDiffDt, maxAdvectDt, 0.00005));
    const numSubSteps = Math.max(1, Math.min(150, Math.ceil(dtTotal / dtSub)));
    const actualDt = dtTotal / numSubSteps;

    for (let s = 0; s < numSubSteps; s++) {
      this.subStep(actualDt);
    }

    this.updateParticles(dtTotal);
  }

  /**
   * Advect tracer particles using bilinear interpolation on velocity field
   * @param {number} dt
   */
  updateParticles(dt) {
    for (let p = 0; p < this.numParticles; p++) {
      const base = p * 4;
      let px = this.particles[base];
      let py = this.particles[base + 1];
      let age = this.particles[base + 2] + 1;

      const gx = (px / this.lx) * this.nx;
      const gy = (py / this.ly) * (this.ny - 1);

      const i0 = Math.floor(gx) % this.nx;
      const j0 = Math.max(0, Math.min(this.ny - 2, Math.floor(gy)));
      const fx = gx - Math.floor(gx);
      const fy = gy - j0;

      const i1 = (i0 + 1) % this.nx;
      const j1 = j0 + 1;

      const idx00 = j0 * this.nx + i0;
      const idx10 = j0 * this.nx + i1;
      const idx01 = j1 * this.nx + i0;
      const idx11 = j1 * this.nx + i1;

      const uInterp = (1 - fx) * (1 - fy) * this.u[idx00] +
                      fx * (1 - fy) * this.u[idx10] +
                      (1 - fx) * fy * this.u[idx01] +
                      fx * fy * this.u[idx11];

      const vInterp = (1 - fx) * (1 - fy) * this.v[idx00] +
                      fx * (1 - fy) * this.v[idx10] +
                      (1 - fx) * fy * this.v[idx01] +
                      fx * fy * this.v[idx11];

      px += uInterp * dt * 0.5;
      py += vInterp * dt * 0.5;

      if (px < 0) px += this.lx;
      if (px >= this.lx) px -= this.lx;

      if (py < 0 || py > this.ly || age > 300) {
        px = this.random() * this.lx;
        py = this.random() * this.ly;
        age = 0;
      }

      this.particles[base] = px;
      this.particles[base + 1] = py;
      this.particles[base + 2] = age;
    }
  }

  /**
   * Diagnostic: Domain-averaged kinetic energy
   * @returns {number}
   */
  getKineticEnergy() {
    let total = 0;
    const n = this.nx * this.ny;
    for (let i = 0; i < n; i++) {
      total += 0.5 * (this.u[i] * this.u[i] + this.v[i] * this.v[i]);
    }
    return total / n;
  }

  /**
   * Diagnostic: Heat and composition fluxes across horizontal midplane
   * @returns {{ fluxT: number, fluxS: number, fluxRatio: number, nusseltS: number }}
   */
  getFluxes() {
    let convT = 0;
    let convS = 0;
    let diffT = 0;
    let diffS = 0;
    const nx = this.nx;
    const ny = this.ny;
    const midJ = Math.floor(ny / 2);

    for (let i = 0; i < nx; i++) {
      const idx = midJ * nx + i;
      const up = (midJ - 1) * nx + i;
      const down = (midJ + 1) * nx + i;

      const vDown = (this.psi[((i + 1) % nx) + midJ * nx] - this.psi[((i - 1 + nx) % nx) + midJ * nx]) / (2.0 * this.dx);

      convT += vDown * this.T[idx];
      convS += vDown * this.S[idx];

      const gradT = (this.T[down] - this.T[up]) / (2.0 * this.dy);
      const gradS = (this.S[down] - this.S[up]) / (2.0 * this.dy);

      diffT -= this.kappaT * gradT;
      diffS -= this.kappaS * gradS;
    }

    const ft = (convT / nx) + (diffT / nx);
    const fs = (convS / nx) + (diffS / nx);

    const gamma = (fs !== 0 && this.rRho > 0) ? (Math.abs(ft) / (this.rRho * Math.abs(fs))) : 0;
    const pureCondFluxS = this.kappaS * (1.0 / this.ly);
    const nusseltS = pureCondFluxS > 0 ? Math.abs(fs) / pureCondFluxS : 1.0;

    return {
      fluxT: ft,
      fluxS: fs,
      fluxRatio: gamma,
      nusseltS: nusseltS
    };
  }

  /**
   * Diagnostic: Dominant horizontal wavenumber of fingers
   * @returns {{ peakWavenumber: number, peakPower: number, fingerCount: number }}
   */
  getFingerSpectrum() {
    const nx = this.nx;
    const midJ = Math.floor(this.ny / 2);
    const slice = new Float64Array(nx);

    let mean = 0;
    for (let i = 0; i < nx; i++) {
      slice[i] = this.S[midJ * nx + i];
      mean += slice[i];
    }
    mean /= nx;

    let maxPower = 0;
    let peakK = 0;

    for (let k = 1; k <= Math.floor(nx / 4); k++) {
      let real = 0;
      let imag = 0;
      for (let i = 0; i < nx; i++) {
        const angle = (2 * Math.PI * k * i) / nx;
        const val = slice[i] - mean;
        real += val * Math.cos(angle);
        imag -= val * Math.sin(angle);
      }
      const power = (real * real + imag * imag) / (nx * nx);
      if (power > maxPower) {
        maxPower = power;
        peakK = k;
      }
    }

    return {
      peakWavenumber: peakK,
      peakPower: maxPower,
      fingerCount: peakK
    };
  }

  /**
   * Diagnostic: Vertical profiles of T, S, and density deviation
   * @returns {{ tProfile: number[], sProfile: number[], rhoProfile: number[] }}
   */
  getVerticalProfiles() {
    const tProf = [];
    const sProf = [];
    const rhoProf = [];

    for (let j = 0; j < this.ny; j++) {
      let sumT = 0;
      let sumS = 0;
      for (let i = 0; i < this.nx; i++) {
        const idx = j * this.nx + i;
        sumT += this.T[idx];
        sumS += this.S[idx];
      }
      const avgT = sumT / this.nx;
      const avgS = sumS / this.nx;
      tProf.push(avgT);
      sProf.push(avgS);

      const invRrho = this.rRho > 0 ? (1.0 / this.rRho) : 1.0;
      const relRho = invRrho * avgS - avgT;
      rhoProf.push(relRho);
    }

    return { tProfile: tProf, sProfile: sProf, rhoProfile: rhoProf };
  }
}
