// @ts-check
import { ChiralRibbonSim } from './simulation.js';

/**
 * 3D Canvas Renderer for Chiral Helical Ribbons, Molecular Graphene Ladders, and Plant Tendrils
 */
export class RibbonRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {ChiralRibbonSim} sim
   */
  constructor(canvas, sim) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.sim = sim;

    // Viewport camera parameters
    this.rotX = 0.35;
    this.rotY = -0.55;
    this.targetRotX = 0.35;
    this.targetRotY = -0.55;
    this.zoom = 1.0;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Visual theme / mode
    this.mode = 'graphene'; // 'graphene' | 'tendril' | 'dual'

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.targetRotY += dx * 0.008;
      this.targetRotX += dy * 0.008;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom *= e.deltaY > 0 ? 0.95 : 1.05;
      this.zoom = Math.max(0.5, Math.min(2.5, this.zoom));
    }, { passive: false });
  }

  /**
   * Resizes canvas buffer to match display resolution (HiDPI)
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Project 3D point (x, y, z) into 2D canvas coordinates
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} cx
   * @param {number} cy
   * @param {number} scale
   * @returns {{ px: number, py: number, depth: number }}
   */
  project(x, y, z, cx, cy, scale) {
    // Rotation around Y
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Rotation around X
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Perspective projection
    const fov = 750;
    const depth = z2 + 850;
    const projScale = (fov / Math.max(50, depth)) * scale * this.zoom;

    return {
      px: cx + x1 * projScale,
      py: cy + y2 * projScale,
      depth: z2
    };
  }

  /**
   * Main render loop frame
   */
  render() {
    this.resize();
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Smooth camera damping
    this.rotX += (this.targetRotX - this.rotX) * 0.1;
    this.rotY += (this.targetRotY - this.rotY) * 0.1;

    // Clear background with rich gradient
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.8);
    bgGrad.addColorStop(0, '#0c1017');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw background coordinate grid / environmental field lines
    this.drawBackgroundField(w, h);

    if (this.mode === 'dual') {
      // Split rendering: left is Graphene Nanoribbon, right is Plant Tendril
      const halfW = w / 2;
      this.renderScene(halfW / 2, h / 2, Math.min(w, h) * 0.0016, 'graphene', 'Graphene Nanoribbon ([4]Helicene Polymer)');
      this.renderScene(halfW + halfW / 2, h / 2, Math.min(w, h) * 0.0016, 'tendril', 'Climbing Plant Tendril (Perversion Mechanics)');

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(halfW, 40);
      ctx.lineTo(halfW, h - 40);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      this.renderScene(w / 2, h / 2, Math.min(w, h) * 0.0022, this.mode, '');
    }
  }

  /**
   * Draws faint chiral solvent / environmental flow lines
   * @param {number} w
   * @param {number} h
   */
  drawBackgroundField(w, h) {
    const { ctx } = this;
    const time = this.sim.time * 0.8;
    const bias = this.sim.h;

    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const y = (h * (i + 0.5)) / 12;
      const alpha = 0.03 + Math.abs(bias) * 0.05;
      ctx.strokeStyle = bias >= 0 ? `rgba(236, 72, 153, ${alpha})` : `rgba(14, 165, 233, ${alpha})`;
      ctx.beginPath();
      for (let x = 0; x < w; x += 30) {
        const swirl = Math.sin(x * 0.008 + time + bias * 3) * (15 * bias);
        if (x === 0) ctx.moveTo(x, y + swirl);
        else ctx.lineTo(x, y + swirl);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Renders a 3D ribbon scene (either graphene or tendril)
   * @param {number} cx Center X
   * @param {number} cy Center Y
   * @param {number} scale Scene scale factor
   * @param {string} style 'graphene' | 'tendril'
   * @param {string} label Header label for dual mode
   */
  renderScene(cx, cy, scale, style, label) {
    const { ctx, sim } = this;
    const N = sim.N;

    if (label) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, 36);
      ctx.restore();
    }

    // Precalculate projected points and ribbon normal vectors
    /** @type {Array<{ px: number, py: number, depth: number, angle: number, spin: number, index: number, x: number, y: number, z: number }>} */
    const nodes = [];

    for (let i = 0; i < N; i++) {
      const x = sim.pointsX[i];
      const y = sim.pointsY[i];
      const z = sim.pointsZ[i];
      const proj = this.project(x, y, z, cx, cy, scale);
      nodes.push({
        px: proj.px,
        py: proj.py,
        depth: proj.depth,
        angle: sim.angles[i],
        spin: sim.spins[i],
        index: i,
        x,
        y,
        z
      });
    }

    // Create ribbon quad polygons sorted by depth
    /** @type {Array<{ i: number, depth: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, p4x: number, p4y: number, spin: number, angle: number }>} */
    const segments = [];
    const ribbonWidth = style === 'graphene' ? 22 : 16;

    for (let i = 0; i < N - 1; i++) {
      const n1 = nodes[i];
      const n2 = nodes[i + 1];

      // Compute ribbon lateral orientation from twist angle
      const twist1 = n1.angle;
      const twist2 = n2.angle;

      // Normal vectors perpendicular to spine
      const perp1X = Math.cos(twist1 + Math.PI / 2) * ribbonWidth;
      const perp1Y = Math.sin(twist1 + Math.PI / 2) * ribbonWidth;
      const perp2X = Math.cos(twist2 + Math.PI / 2) * ribbonWidth;
      const perp2Y = Math.sin(twist2 + Math.PI / 2) * ribbonWidth;

      const pt1A = this.project(n1.x + perp1X, n1.y + perp1Y, n1.z, cx, cy, scale);
      const pt1B = this.project(n1.x - perp1X, n1.y - perp1Y, n1.z, cx, cy, scale);
      const pt2A = this.project(n2.x + perp2X, n2.y + perp2Y, n2.z, cx, cy, scale);
      const pt2B = this.project(n2.x - perp2X, n2.y - perp2Y, n2.z, cx, cy, scale);

      const avgDepth = (pt1A.depth + pt1B.depth + pt2A.depth + pt2B.depth) / 4;

      segments.push({
        i,
        depth: avgDepth,
        p1x: pt1A.px,
        p1y: pt1A.py,
        p2x: pt2A.px,
        p2y: pt2A.py,
        p3x: pt2B.px,
        p3y: pt2B.py,
        p4x: pt1B.px,
        p4y: pt1B.py,
        spin: n1.spin,
        angle: n1.angle
      });
    }

    // Sort back-to-front (Painter's algorithm)
    segments.sort((a, b) => b.depth - a.depth);

    // Draw ribbon segments
    for (const seg of segments) {
      this.drawRibbonSegment(ctx, seg, style);
    }

    // Highlight perversion points (domain walls where chirality flips)
    this.drawPerversionHighlights(ctx, nodes, cx, cy, scale, style);

    // If pinned ends, draw boundary anchor grips
    if (sim.pinnedEnds) {
      this.drawAnchorGrip(ctx, nodes[0], style);
      this.drawAnchorGrip(ctx, nodes[N - 1], style);
    }
  }

  /**
   * Draws an individual quad segment with theme-specific textures & lighting
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ i: number, depth: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, p4x: number, p4y: number, spin: number, angle: number }} seg
   * @param {string} style
   */
  drawRibbonSegment(ctx, seg, style) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(seg.p1x, seg.p1y);
    ctx.lineTo(seg.p2x, seg.p2y);
    ctx.lineTo(seg.p3x, seg.p3y);
    ctx.lineTo(seg.p4x, seg.p4y);
    ctx.closePath();

    // Lighting gradient based on normal & twist angle
    const angleNorm = (seg.angle + Math.PI / 2) / Math.PI; // 0 to 1
    const grad = ctx.createLinearGradient(seg.p1x, seg.p1y, seg.p4x, seg.p4y);

    if (style === 'graphene') {
      // Graphene Nanoribbon: Cyan/Blue (Left/M) vs Magenta/Gold (Right/P)
      if (seg.spin > 0) {
        // Right-handed (P)
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.85)'); // Rose
        grad.addColorStop(0.5, 'rgba(251, 146, 60, 0.95)'); // Amber / Gold
        grad.addColorStop(1, 'rgba(190, 18, 60, 0.85)');
      } else {
        // Left-handed (M)
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.85)'); // Cyan
        grad.addColorStop(0.5, 'rgba(59, 130, 246, 0.95)'); // Blue
        grad.addColorStop(1, 'rgba(14, 116, 144, 0.85)');
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // Draw fused aromatic rings grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ring center hexagonal motif
      const midX = (seg.p1x + seg.p2x + seg.p3x + seg.p4x) / 4;
      const midY = (seg.p1y + seg.p2y + seg.p3y + seg.p4y) / 4;
      ctx.fillStyle = seg.spin > 0 ? 'rgba(255, 220, 150, 0.5)' : 'rgba(180, 240, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(midX, midY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Plant Tendril: Emerald green botanical cellular texture with perversion indicators
      if (seg.spin > 0) {
        grad.addColorStop(0, '#10b981'); // Emerald
        grad.addColorStop(0.5, '#34d399'); // Mint
        grad.addColorStop(1, '#059669');
      } else {
        grad.addColorStop(0, '#0d9488'); // Teal
        grad.addColorStop(0.5, '#2dd4bf'); // Light Teal
        grad.addColorStop(1, '#115e59');
      }

      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(200, 255, 200, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Botanical rib lines along center
      const mid1x = (seg.p1x + seg.p4x) / 2;
      const mid1y = (seg.p1y + seg.p4y) / 2;
      const mid2x = (seg.p2x + seg.p3x) / 2;
      const mid2y = (seg.p2y + seg.p3y) / 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mid1x, mid1y);
      ctx.lineTo(mid2x, mid2y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Highlights topological perversion points (kinks)
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{ px: number, py: number, depth: number, spin: number, index: number }>} nodes
   * @param {number} cx
   * @param {number} cy
   * @param {number} scale
   * @param {string} style
   */
  drawPerversionHighlights(ctx, nodes, cx, cy, scale, style) {
    const N = nodes.length;
    const time = this.sim.time * 4;

    for (let i = 0; i < N - 1; i++) {
      if (nodes[i].spin !== nodes[i + 1].spin) {
        const kx = (nodes[i].px + nodes[i + 1].px) / 2;
        const ky = (nodes[i].py + nodes[i + 1].py) / 2;

        ctx.save();
        // Pulsing halo at the perversion node
        const pulse = 8 + Math.sin(time + i) * 3;
        const haloGrad = ctx.createRadialGradient(kx, ky, 2, kx, ky, pulse * 2.5);
        haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        haloGrad.addColorStop(0.4, 'rgba(234, 179, 8, 0.8)'); // Yellow / Amber
        haloGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(kx, ky, pulse * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Kink icon & label
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(kx, ky, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ PERVERSION NODE', kx, ky - pulse - 6);
        ctx.restore();
      }
    }
  }

  /**
   * Draws clamped mechanical anchor clamps on ribbon boundaries
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ px: number, py: number }} node
   * @param {string} style
   */
  drawAnchorGrip(ctx, node, style) {
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.rect(node.px - 14, node.py - 14, 28, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ANCHOR', node.px, node.py + 3);
    ctx.restore();
  }
}
