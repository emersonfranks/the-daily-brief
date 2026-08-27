// @ts-check
import { PhysarumNetwork } from './physarum.js';

/**
 * @typedef {'bio' | 'network'} VisualMode
 */

/**
 * Canvas Renderer for Physarum Transport & Dynamic Routing
 */
export class NetworkRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {PhysarumNetwork} network
   */
  constructor(canvas, network) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.network = network;
    /** @type {VisualMode} */
    this.mode = 'bio';

    this.hoveredNodeId = -1;
    this.hoveredEdgeId = -1;
    this.selectedNodeId = -1;

    this.animationPhase = 0;
    this.particles = [];
    this.initParticles(80);

    this.showPressureField = false;
    this.showLabels = true;
    this.isCutting = false;
  }

  /**
   * Initialize floating flow particles for tactile stream visualization
   * @param {number} count
   */
  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        edgeIndex: Math.floor(Math.random() * Math.max(1, this.network.edges.length)),
        progress: Math.random(),
        speedFactor: 0.8 + Math.random() * 0.4
      });
    }
  }

  /**
   * Resize canvas backing buffer to match display resolution
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));

    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }
  }

  /**
   * Set visual mode ('bio' or 'network')
   * @param {VisualMode} mode
   */
  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Draw full frame
   * @param {number} dt - frame time delta in seconds
   */
  render(dt = 0.016) {
    this.resize();
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    this.animationPhase += dt * 3.5;

    // Background
    if (this.mode === 'bio') {
      // Dark agar petri dish background with subtle radial vignette
      const bgGrad = this.ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height) * 0.7);
      bgGrad.addColorStop(0, '#151912');
      bgGrad.addColorStop(1, '#080a06');
      this.ctx.fillStyle = bgGrad;
      this.ctx.fillRect(0, 0, width, height);

      // Subtle agar nutrient texture / grid
      this.drawPetriGrid(width, height);
    } else {
      // Cybernetic dark circuit background
      const bgGrad = this.ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0a0e17');
      bgGrad.addColorStop(1, '#05070c');
      this.ctx.fillStyle = bgGrad;
      this.ctx.fillRect(0, 0, width, height);

      this.drawCircuitGrid(width, height);
    }

    // Edges (Veins / Conduits)
    this.drawEdges();

    // Flow particles along active conduits
    this.drawParticles(dt);

    // Nodes (Food sources / Routers)
    this.drawNodes();

    // Hover tooltip info overlay
    this.drawOverlay();

    this.ctx.restore();
  }

  /**
   * Draw agar plate grid
   * @param {number} w
   * @param {number} h
   */
  drawPetriGrid(w, h) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(70, 95, 55, 0.07)';
    this.ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  /**
   * Draw circuit mesh grid
   * @param {number} w
   * @param {number} h
   */
  drawCircuitGrid(w, h) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 180, 255, 0.05)';
    this.ctx.lineWidth = 1;
    const step = 30;
    for (let x = 0; x < w; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  /**
   * Draw all conduits (edges)
   */
  drawEdges() {
    for (const edge of this.network.edges) {
      const u = this.network.nodes[edge.u];
      const v = this.network.nodes[edge.v];
      if (!u || !v) continue;

      const isHovered = edge.id === this.hoveredEdgeId;
      const isSevered = edge.severed;
      const cond = Math.max(0, edge.conductivity);
      const flux = Math.abs(edge.flux);

      if (isSevered) {
        // Red dashed severed cut marker
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(u.x, u.y);
        this.ctx.lineTo(v.x, v.y);
        this.ctx.stroke();

        // X mark at center
        const mx = (u.x + v.x) / 2;
        const my = (u.y + v.y) / 2;
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(mx - 6, my - 6);
        this.ctx.lineTo(mx + 6, my + 6);
        this.ctx.moveTo(mx + 6, my - 6);
        this.ctx.lineTo(mx - 6, my + 6);
        this.ctx.stroke();
        this.ctx.restore();
        continue;
      }

      // Base width scales with sqrt of conductivity (tube radius r ~ sqrt(D))
      const radius = Math.max(0.6, Math.sqrt(cond) * 4.5);
      const pulse = Math.sin(this.animationPhase + edge.id * 1.3) * 0.15;
      const drawWidth = isHovered ? radius * 1.5 + 2 : radius * (1 + pulse);

      this.ctx.save();
      if (this.mode === 'bio') {
        // Bioluminescent Physarum cytoplasm vein
        if (cond > 0.05) {
          // Outer sheath glow
          this.ctx.strokeStyle = isHovered
            ? 'rgba(255, 230, 80, 0.8)'
            : `rgba(230, 200, 40, ${Math.min(0.85, 0.15 + cond * 0.3)})`;
          this.ctx.lineWidth = drawWidth + 3;
          this.ctx.beginPath();
          this.ctx.moveTo(u.x, u.y);
          this.ctx.lineTo(v.x, v.y);
          this.ctx.stroke();

          // Inner pulsing protoplasmic core
          this.ctx.strokeStyle = isHovered
            ? '#fff677'
            : `rgb(${Math.min(255, 210 + Math.floor(flux * 30))}, ${Math.min(255, 230 + Math.floor(flux * 15))}, 70)`;
          this.ctx.lineWidth = Math.max(1, drawWidth * 0.7);
          this.ctx.beginPath();
          this.ctx.moveTo(u.x, u.y);
          this.ctx.lineTo(v.x, v.y);
          this.ctx.stroke();
        } else {
          // Faint dormant / decaying vein trace
          this.ctx.strokeStyle = 'rgba(100, 120, 70, 0.15)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(u.x, u.y);
          this.ctx.lineTo(v.x, v.y);
          this.ctx.stroke();
        }
      } else {
        // High-tech Data / Transit Fiber Optic
        if (cond > 0.05) {
          this.ctx.strokeStyle = isHovered
            ? 'rgba(0, 255, 240, 0.9)'
            : `rgba(0, 190, 255, ${Math.min(0.85, 0.2 + cond * 0.3)})`;
          this.ctx.lineWidth = drawWidth + 2;
          this.ctx.beginPath();
          this.ctx.moveTo(u.x, u.y);
          this.ctx.lineTo(v.x, v.y);
          this.ctx.stroke();

          this.ctx.strokeStyle = isHovered ? '#ffffff' : '#7df9ff';
          this.ctx.lineWidth = Math.max(1, drawWidth * 0.5);
          this.ctx.beginPath();
          this.ctx.moveTo(u.x, u.y);
          this.ctx.lineTo(v.x, v.y);
          this.ctx.stroke();
        } else {
          this.ctx.strokeStyle = 'rgba(50, 90, 140, 0.18)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(u.x, u.y);
          this.ctx.lineTo(v.x, v.y);
          this.ctx.stroke();
        }
      }
      this.ctx.restore();
    }
  }

  /**
   * Draw moving protoplasmic particles/packets along active edges
   * @param {number} dt
   */
  drawParticles(dt) {
    if (this.network.edges.length === 0) return;

    this.ctx.save();
    for (const p of this.particles) {
      if (p.edgeIndex >= this.network.edges.length) {
        p.edgeIndex = Math.floor(Math.random() * this.network.edges.length);
      }
      const edge = this.network.edges[p.edgeIndex];
      if (!edge || edge.severed || edge.conductivity < 0.03 || Math.abs(edge.flux) < 0.001) {
        p.edgeIndex = Math.floor(Math.random() * this.network.edges.length);
        p.progress = Math.random();
        continue;
      }

      const u = this.network.nodes[edge.u];
      const v = this.network.nodes[edge.v];
      if (!u || !v) continue;

      // Flow direction is from higher potential to lower potential
      const flux = edge.flux;
      const speed = Math.max(0.1, Math.min(2.5, Math.abs(edge.velocity) * 1.5)) * p.speedFactor;

      if (flux >= 0) {
        // u -> v
        p.progress += dt * (speed * 120 / edge.length);
        if (p.progress > 1) p.progress -= 1;
      } else {
        // v -> u
        p.progress -= dt * (speed * 120 / edge.length);
        if (p.progress < 0) p.progress += 1;
      }

      const px = u.x + (v.x - u.x) * p.progress;
      const py = u.y + (v.y - u.y) * p.progress;

      if (this.mode === 'bio') {
        this.ctx.fillStyle = 'rgba(255, 255, 180, 0.85)';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillStyle = 'rgba(100, 255, 255, 0.95)';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 2.0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  /**
   * Draw all nodes
   */
  drawNodes() {
    for (const node of this.network.nodes) {
      const isHovered = node.id === this.hoveredNodeId;
      const isSelected = node.id === this.selectedNodeId;
      const isFood = node.isFood || Math.abs(node.sourceCurrent) > 0.05;
      const current = node.sourceCurrent;
      const pressure = this.network.pressures[node.id] || 0;

      this.ctx.save();

      if (isFood) {
        // High-importance Food source or Router Gateway
        const isSource = current > 0;
        const radius = 11 + Math.min(6, Math.abs(current) * 3);

        // Soft outer ambient halo
        const haloGrad = this.ctx.createRadialGradient(node.x, node.y, radius * 0.5, node.x, node.y, radius * 2.2);
        if (this.mode === 'bio') {
          haloGrad.addColorStop(0, isSource ? 'rgba(255, 215, 0, 0.5)' : 'rgba(160, 230, 80, 0.4)');
          haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          haloGrad.addColorStop(0, isSource ? 'rgba(0, 220, 255, 0.6)' : 'rgba(140, 90, 255, 0.5)');
          haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }
        this.ctx.fillStyle = haloGrad;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius * 2.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Node core circle
        this.ctx.fillStyle = this.mode === 'bio'
          ? (isSource ? '#ffd700' : '#84cc16')
          : (isSource ? '#06b6d4' : '#a855f7');
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = (isHovered || isSelected) ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = (isHovered || isSelected) ? 3 : 1.5;
        this.ctx.stroke();

        // Center icon / indicator
        this.ctx.fillStyle = '#111827';
        this.ctx.font = 'bold 11px system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const symbol = isSource ? '+' : '−';
        this.ctx.fillText(symbol, node.x, node.y);

        // Label if available
        if (this.showLabels && node.label) {
          this.ctx.font = '11px system-ui, sans-serif';
          this.ctx.fillStyle = this.mode === 'bio' ? '#fef08a' : '#cffafe';
          this.ctx.fillText(node.label, node.x, node.y - radius - 7);
        }
      } else {
        // Intermediate junction node
        const radius = isHovered ? 6 : 4;
        this.ctx.fillStyle = this.mode === 'bio'
          ? (isHovered ? '#fef08a' : 'rgba(180, 200, 120, 0.6)')
          : (isHovered ? '#67e8f9' : 'rgba(100, 160, 220, 0.6)');
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        if (isHovered) {
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
        }
      }

      this.ctx.restore();
    }
  }

  /**
   * Draw hover HUD overlay
   */
  drawOverlay() {
    if (this.hoveredEdgeId > 0) {
      const edge = this.network.edges.find(e => e.id === this.hoveredEdgeId);
      if (edge) {
        const u = this.network.nodes[edge.u];
        const v = this.network.nodes[edge.v];
        if (u && v) {
          const mx = (u.x + v.x) / 2;
          const my = (u.y + v.y) / 2;

          this.drawBadge(
            mx,
            my - 18,
            `Conduit #${edge.id} | D: ${edge.conductivity.toFixed(3)} | Flux: ${Math.abs(edge.flux).toFixed(3)} | L: ${edge.length.toFixed(0)}px`
          );
        }
      }
    } else if (this.hoveredNodeId >= 0) {
      const node = this.network.nodes[this.hoveredNodeId];
      if (node) {
        const p = this.network.pressures[node.id] || 0;
        const role = node.sourceCurrent > 0
          ? `Source (+${node.sourceCurrent.toFixed(1)})`
          : (node.sourceCurrent < 0 ? `Sink (${node.sourceCurrent.toFixed(1)})` : 'Junction');

        this.drawBadge(
          node.x,
          node.y + 22,
          `Node #${node.id} (${role}) | Potential p: ${p.toFixed(2)}`
        );
      }
    }
  }

  /**
   * Draw floating information badge
   * @param {number} x
   * @param {number} y
   * @param {string} text
   */
  drawBadge(x, y, text) {
    this.ctx.save();
    this.ctx.font = '11px monospace';
    const textWidth = this.ctx.measureText(text).width;
    const pad = 6;
    const h = 18;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    this.ctx.lineWidth = 1;

    const bx = Math.max(10, Math.min(this.canvas.width / (window.devicePixelRatio || 1) - textWidth - pad * 2 - 10, x - textWidth / 2 - pad));
    const by = Math.max(10, y);

    this.ctx.fillRect(bx, by, textWidth + pad * 2, h);
    this.ctx.strokeRect(bx, by, textWidth + pad * 2, h);

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, bx + pad, by + h / 2);
    this.ctx.restore();
  }

  /**
   * Hit test node at (x, y)
   * @param {number} x
   * @param {number} y
   * @returns {number} Node ID or -1
   */
  findNodeAt(x, y) {
    for (const node of this.network.nodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      const threshold = (node.isFood ? 18 : 12);
      if (dx * dx + dy * dy <= threshold * threshold) {
        return node.id;
      }
    }
    return -1;
  }

  /**
   * Hit test edge at (x, y)
   * @param {number} x
   * @param {number} y
   * @returns {number} Edge ID or -1
   */
  findEdgeAt(x, y) {
    for (const edge of this.network.edges) {
      const u = this.network.nodes[edge.u];
      const v = this.network.nodes[edge.v];
      if (!u || !v) continue;

      const dist = pointToSegmentDistance(x, y, u.x, u.y, v.x, v.y);
      if (dist <= 10) {
        return edge.id;
      }
    }
    return -1;
  }
}

/**
 * Compute perpendicular distance from point to line segment
 * @param {number} px
 * @param {number} py
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}
