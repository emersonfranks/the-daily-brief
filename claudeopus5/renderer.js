// @ts-check

/**
 * Draws one swarm twice. The two panels are fed the same `theta` array on the
 * same frame; nothing is simulated here and nothing is simulated separately per
 * panel. That is the whole argument of the page, so it is worth stating in code:
 * if the panels ever disagree it is a drawing bug, not two systems behaving
 * differently.
 */

import { makeRandom } from './kuramoto.js';

const LOCKED = '#ffcf5c';
const DRIFTING = '#4a6b8a';

/**
 * @typedef {object} Frame
 * @property {Float64Array} theta
 * @property {Float64Array} omega
 * @property {number} K
 * @property {number} r
 * @property {number} psi
 * @property {number[]} history Recent coherence values, oldest first.
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number }}
 */
function prepare(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

/**
 * @param {number} n
 * @param {number} seed
 * @returns {{ x: number, y: number, size: number }[]}
 */
function scatter(n, seed) {
  const random = makeRandom(seed);
  const spots = [];
  for (let i = 0; i < n; i++) {
    // Biased towards the lower half so the swarm reads as sitting in foliage
    // rather than floating in a uniform box.
    const y = 0.12 + 0.86 * Math.sqrt(random());
    spots.push({ x: 0.04 + 0.92 * random(), y, size: 1.4 + 2.2 * random() });
  }
  return spots;
}

/**
 * @param {object} options
 * @param {HTMLCanvasElement} options.fireflies
 * @param {HTMLCanvasElement} options.rotors
 * @param {HTMLCanvasElement} options.trace
 * @param {number} options.n
 * @param {number} [options.seed]
 */
export function createRenderer({ fireflies, rotors, trace, n, seed = 3 }) {
  const spots = scatter(n, seed);

  /**
   * @param {Frame} frame
   * @returns {Uint8Array} 1 where the oscillator is entrained by the mean field.
   */
  function lockedMask(frame) {
    const mask = new Uint8Array(n);
    const pull = frame.K * frame.r;
    for (let i = 0; i < n; i++) mask[i] = Math.abs(frame.omega[i]) <= pull ? 1 : 0;
    return mask;
  }

  /**
   * @param {Frame} frame
   * @param {Uint8Array} mask
   */
  function drawFireflies(frame, mask) {
    const { ctx, width, height } = prepare(fireflies);
    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#080d14');
    backdrop.addColorStop(1, '#0d1520');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < n; i++) {
      const phase = Math.cos(frame.theta[i]);
      const glow = phase > 0 ? phase ** 10 : 0;
      if (glow < 0.02) continue;
      const spot = spots[i];
      const x = spot.x * width;
      const y = spot.y * height;
      const radius = spot.size * (1 + 2.4 * glow);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.4);
      const tint = mask[i] ? '255, 214, 110' : '132, 178, 226';
      halo.addColorStop(0, `rgba(${tint}, ${0.95 * glow})`);
      halo.addColorStop(0.35, `rgba(${tint}, ${0.34 * glow})`);
      halo.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * @param {Frame} frame
   * @param {Uint8Array} mask
   */
  function drawRotors(frame, mask) {
    const { ctx, width, height } = prepare(rotors);
    ctx.fillStyle = '#080d14';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const ring = Math.min(width, height) * 0.36;

    ctx.strokeStyle = 'rgba(120, 150, 180, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, ring, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const angle = frame.theta[i];
      const wobble = ring + ((i % 7) - 3) * 2.1;
      const x = cx + wobble * Math.cos(angle);
      const y = cy + wobble * Math.sin(angle);
      ctx.fillStyle = mask[i] ? LOCKED : DRIFTING;
      ctx.globalAlpha = mask[i] ? 0.85 : 0.5;
      ctx.beginPath();
      ctx.arc(x, y, mask[i] ? 2.3 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const armX = cx + ring * frame.r * Math.cos(frame.psi);
    const armY = cy + ring * frame.r * Math.sin(frame.psi);
    ctx.strokeStyle = '#ffcf5c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(armX, armY);
    ctx.stroke();
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(armX, armY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * @param {Frame} frame
   * @param {number} critical
   */
  function drawTrace(frame, critical) {
    const { ctx, width, height } = prepare(trace);
    ctx.fillStyle = '#080d14';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(120, 150, 180, 0.2)';
    ctx.lineWidth = 1;
    for (const level of [0.25, 0.5, 0.75]) {
      const y = height - level * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const points = frame.history;
    if (points.length > 1) {
      ctx.strokeStyle = frame.K >= critical ? LOCKED : '#6f93b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((value, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - value * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  return {
    /**
     * @param {Frame} frame
     * @param {number} critical
     */
    draw(frame, critical) {
      const mask = lockedMask(frame);
      drawFireflies(frame, mask);
      drawRotors(frame, mask);
      drawTrace(frame, critical);
      return mask;
    },
  };
}
