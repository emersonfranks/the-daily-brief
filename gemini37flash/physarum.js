// @ts-check

/**
 * @typedef {Object} Node
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} sourceCurrent - Injected external current (positive for source/food, negative for sink, 0 for junction)
 * @property {string} [label]
 * @property {boolean} [isFood]
 */

/**
 * @typedef {Object} Edge
 * @property {number} id
 * @property {number} u - Source node id
 * @property {number} v - Target node id
 * @property {number} length - Physical length of the conduit
 * @property {number} conductivity - D_ij (protoplasmic tube diameter / bandwidth conductance)
 * @property {number} flux - Q_ij (flow rate through the tube)
 * @property {number} velocity - Flow velocity (flux / conductivity)
 * @property {boolean} severed - Whether this conduit has been physically cut
 */

/**
 * @typedef {Object} SimulationConfig
 * @property {number} [gamma] - Adaptation feedback exponent (gamma > 1 favors extreme pruning/trees, gamma < 1 preserves meshes)
 * @property {number} [decayRate] - Tube natural decay rate r
 * @property {number} [dt] - Time step per adaptation iteration
 * @property {number} [minConductivity] - Floor conductivity for dormant veins (allows exploration/rerouting)
 * @property {number} [maxConductivity] - Ceil conductivity
 * @property {number} [initialConductivity] - Initial tube conductivity
 */

/**
 * Core Physarum / Kirchhoff-Poiseuille Transport Network Model
 * Implements the Tero-Kobayashi-Nakagaki (2007, Science 2010) model of adaptive network morphogenesis.
 */
export class PhysarumNetwork {
  /**
   * @param {SimulationConfig} [config]
   */
  constructor(config = {}) {
    this.gamma = config.gamma ?? 1.2;
    this.decayRate = config.decayRate ?? 1.0;
    this.dt = config.dt ?? 0.05;
    this.minConductivity = config.minConductivity ?? 0.001;
    this.maxConductivity = config.maxConductivity ?? 5.0;
    this.initialConductivity = config.initialConductivity ?? 1.0;

    /** @type {Node[]} */
    this.nodes = [];
    /** @type {Edge[]} */
    this.edges = [];
    /** @type {number[]} */
    this.pressures = [];

    this.stepCount = 0;
    this.nextEdgeId = 1;
  }

  /**
   * Reset the network
   */
  clear() {
    this.nodes = [];
    this.edges = [];
    this.pressures = [];
    this.stepCount = 0;
    this.nextEdgeId = 1;
  }

  /**
   * Add a node to the network
   * @param {number} x
   * @param {number} y
   * @param {number} [sourceCurrent=0]
   * @param {string} [label]
   * @param {boolean} [isFood=false]
   * @returns {Node}
   */
  addNode(x, y, sourceCurrent = 0, label = '', isFood = false) {
    const id = this.nodes.length;
    /** @type {Node} */
    const node = { id, x, y, sourceCurrent, label, isFood: isFood || Math.abs(sourceCurrent) > 0.01 };
    this.nodes.push(node);
    this.pressures.push(0);
    return node;
  }

  /**
   * Add an edge between two nodes
   * @param {number} u
   * @param {number} v
   * @param {number} [initialD]
   * @returns {Edge|null}
   */
  addEdge(u, v, initialD) {
    if (u === v || u < 0 || v < 0 || u >= this.nodes.length || v >= this.nodes.length) {
      return null;
    }
    // Avoid duplicate edges
    const existing = this.edges.find(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
    if (existing) return existing;

    const dx = this.nodes[u].x - this.nodes[v].x;
    const dy = this.nodes[u].y - this.nodes[v].y;
    const length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
    const conductivity = initialD ?? this.initialConductivity;

    /** @type {Edge} */
    const edge = {
      id: this.nextEdgeId++,
      u,
      v,
      length,
      conductivity,
      flux: 0,
      velocity: 0,
      severed: false
    };
    this.edges.push(edge);
    return edge;
  }

  /**
   * Solve Kirchhoff's nodal equations for fluid/electric pressures:
   * Sum_j (D_ij / L_ij) * (p_i - p_j) = I_i
   * Solved using dense Gaussian elimination with partial pivoting.
   * Node 0 (or first grounded node) is clamped to p = 0 to fix reference potential.
   * @returns {number[]} Calculated pressures
   */
  solveKirchhoffPressures() {
    const n = this.nodes.length;
    if (n === 0) return [];
    if (n === 1) {
      this.pressures = [0];
      return this.pressures;
    }

    // Build Laplacian conductance matrix K and right-hand side vector b
    // K_ij = -D_ij / L_ij (for i != j)
    // K_ii = Sum_{j != i} D_ij / L_ij
    // b_i = sourceCurrent_i
    const K = Array.from({ length: n }, () => new Float64Array(n));
    const b = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      b[i] = this.nodes[i].sourceCurrent;
    }

    for (const edge of this.edges) {
      if (edge.severed || edge.conductivity <= 0) continue;
      const conductance = edge.conductivity / edge.length;
      K[edge.u][edge.v] -= conductance;
      K[edge.v][edge.u] -= conductance;
      K[edge.u][edge.u] += conductance;
      K[edge.v][edge.v] += conductance;
    }

    // Ground reference: Node 0 is set to p_0 = 0
    // Replace row 0 with p_0 = 0
    for (let j = 0; j < n; j++) {
      K[0][j] = (j === 0) ? 1.0 : 0.0;
    }
    b[0] = 0.0;

    // Gaussian elimination with partial pivoting
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      let maxVal = Math.abs(K[i][i]);
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(K[k][i]) > maxVal) {
          maxVal = Math.abs(K[k][i]);
          maxRow = k;
        }
      }

      if (maxRow !== i) {
        const tempRow = K[i];
        K[i] = K[maxRow];
        K[maxRow] = tempRow;
        const tempB = b[i];
        b[i] = b[maxRow];
        b[maxRow] = tempB;
      }

      const pivot = K[i][i];
      if (Math.abs(pivot) < 1e-12) {
        // Singular / disconnected node: regularize slightly
        K[i][i] = 1.0;
        b[i] = 0.0;
        continue;
      }

      for (let k = i + 1; k < n; k++) {
        const factor = K[k][i] / pivot;
        for (let j = i; j < n; j++) {
          K[k][j] -= factor * K[i][j];
        }
        b[k] -= factor * b[i];
      }
    }

    // Back substitution
    const p = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= K[i][j] * p[j];
      }
      p[i] = Math.abs(K[i][i]) > 1e-12 ? sum / K[i][i] : 0;
    }

    this.pressures = Array.from(p);
    return this.pressures;
  }

  /**
   * Calculate Poiseuille flux for all conduits:
   * Q_ij = (D_ij / L_ij) * (p_i - p_j)
   */
  updateFluxes() {
    this.solveKirchhoffPressures();

    for (const edge of this.edges) {
      if (edge.severed || edge.conductivity <= 0) {
        edge.flux = 0;
        edge.velocity = 0;
        continue;
      }
      const conductance = edge.conductivity / edge.length;
      const dp = this.pressures[edge.u] - this.pressures[edge.v];
      edge.flux = conductance * dp;
      edge.velocity = edge.conductivity > 0 ? edge.flux / edge.conductivity : 0;
    }
  }

  /**
   * Advance one time step of biological/network adaptation:
   * dD_ij / dt = |Q_ij|^gamma - r * D_ij
   */
  step() {
    this.updateFluxes();

    for (const edge of this.edges) {
      if (edge.severed) {
        edge.conductivity = 0;
        continue;
      }
      const absFlux = Math.abs(edge.flux);
      const growth = Math.pow(absFlux, this.gamma);
      const decay = this.decayRate * edge.conductivity;
      const dD = (growth - decay) * this.dt;

      edge.conductivity = Math.max(
        this.minConductivity,
        Math.min(this.maxConductivity, edge.conductivity + dD)
      );
    }

    this.stepCount++;
  }

  /**
   * Run simulation for N steps headlessly
   * @param {number} steps
   */
  runSteps(steps) {
    for (let i = 0; i < steps; i++) {
      this.step();
    }
  }

  /**
   * Measure the current total network length (cost of active conduits)
   * @param {number} [threshold=0.05]
   * @returns {number}
   */
  getActiveNetworkLength(threshold = 0.05) {
    let totalLength = 0;
    for (const edge of this.edges) {
      if (!edge.severed && edge.conductivity > threshold) {
        totalLength += edge.length;
      }
    }
    return totalLength;
  }

  /**
   * Measure flux conservation error across all intermediate junction nodes (sourceCurrent = 0)
   * Returns max absolute divergence |Sum Q_in - Sum Q_out|
   * @returns {number}
   */
  getMaxFluxConservationError() {
    this.updateFluxes();
    let maxError = 0;
    for (const node of this.nodes) {
      if (Math.abs(node.sourceCurrent) < 1e-6) {
        let netFlux = 0;
        for (const edge of this.edges) {
          if (edge.severed) continue;
          if (edge.u === node.id) {
            netFlux += edge.flux; // Leaving node
          } else if (edge.v === node.id) {
            netFlux -= edge.flux; // Entering node
          }
        }
        maxError = Math.max(maxError, Math.abs(netFlux));
      }
    }
    return maxError;
  }

  /**
   * Sever an edge by ID
   * @param {number} edgeId
   */
  severEdge(edgeId) {
    const edge = this.edges.find(e => e.id === edgeId);
    if (edge) {
      edge.severed = true;
      edge.conductivity = 0;
      edge.flux = 0;
    }
  }

  /**
   * Restore all severed edges
   */
  restoreAllEdges() {
    for (const edge of this.edges) {
      if (edge.severed) {
        edge.severed = false;
        edge.conductivity = this.minConductivity * 2;
      }
    }
  }

  // --- Preset Generators ---

  /**
   * Preset 1: The Classic Double Bridge (Shortest Path Selection)
   * Two food nodes connected by two alternative paths: short (L1) and long (L2).
   * @param {number} [lengthRatio=2.0]
   */
  setupDoubleBridge(lengthRatio = 2.0) {
    this.clear();
    const nSource = this.addNode(80, 200, 1.0, 'Nutrient Source A (Tokyo)', true);
    const nSink = this.addNode(480, 200, -1.0, 'Nutrient Sink B (Yokohama)', true);

    // Path 1 (Direct Short Path: length ~ 400)
    // Path 2 (Detour Long Path: through high arc)
    const arcHeight = 120 * lengthRatio;
    const nArc = this.addNode(280, 200 - arcHeight, 0, 'Detour Junction');

    this.addEdge(nSource.id, nSink.id, 1.0); // Direct conduit
    this.addEdge(nSource.id, nArc.id, 1.0);
    this.addEdge(nArc.id, nSink.id, 1.0);

    this.updateFluxes();
  }

  /**
   * Preset 2: Hexagonal Protoplasmic Lattice (Mesh Pruning to Steiner Spanning Tree)
   * A triangular/hex lattice with multiple food sources placed at perimeter points.
   */
  setupLattice(rows = 5, cols = 7, spacing = 70) {
    this.clear();
    const grid = [];
    const offsetX = 60;
    const offsetY = 50;

    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * spacing + (r % 2 === 1 ? spacing * 0.5 : 0);
        const y = offsetY + r * (spacing * 0.866);
        const node = this.addNode(x, y, 0);
        grid[r][c] = node.id;
      }
    }

    // Connect lattice edges (triangular mesh)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = grid[r][c];
        // Horizontal neighbor
        if (c + 1 < cols) {
          this.addEdge(u, grid[r][c + 1]);
        }
        // Diagonal neighbors
        if (r + 1 < rows) {
          this.addEdge(u, grid[r + 1][c]);
          if (r % 2 === 0) {
            if (c - 1 >= 0) this.addEdge(u, grid[r + 1][c - 1]);
          } else {
            if (c + 1 < cols) this.addEdge(u, grid[r + 1][c + 1]);
          }
        }
      }
    }

    // Set food source/sink at corners & center (Tokyo-style hub distribution)
    const topLeft = grid[0][0];
    const topRight = grid[0][cols - 1];
    const bottomLeft = grid[rows - 1][0];
    const bottomRight = grid[rows - 1][cols - 1];
    const center = grid[Math.floor(rows / 2)][Math.floor(cols / 2)];

    this.nodes[center].sourceCurrent = 3.0;
    this.nodes[center].isFood = true;
    this.nodes[center].label = 'Central Hub (Tokyo Central)';

    this.nodes[topLeft].sourceCurrent = -1.0;
    this.nodes[topLeft].isFood = true;
    this.nodes[topLeft].label = 'Sub-center (Chiba)';

    this.nodes[topRight].sourceCurrent = -1.0;
    this.nodes[topRight].isFood = true;
    this.nodes[topRight].label = 'Sub-center (Saitama)';

    this.nodes[bottomLeft].sourceCurrent = -0.5;
    this.nodes[bottomLeft].isFood = true;
    this.nodes[bottomLeft].label = 'Sub-center (Yokohama)';

    this.nodes[bottomRight].sourceCurrent = -0.5;
    this.nodes[bottomRight].isFood = true;
    this.nodes[bottomRight].label = 'Sub-center (Kawasaki)';

    this.updateFluxes();
  }

  /**
   * Preset 3: Fault-Tolerant Byzantine Ring / Diamond
   * Tests dynamic self-healing when the primary artery is severed.
   */
  setupFaultTolerantMesh() {
    this.clear();
    const src = this.addNode(80, 200, 2.0, 'Data Gateway (Primary Ingress)', true);
    const top = this.addNode(280, 90, 0, 'Backbone Alpha');
    const mid = this.addNode(280, 200, 0, 'Direct Fiber Artery');
    const bot = this.addNode(280, 310, 0, 'Backbone Beta');
    const dst = this.addNode(480, 200, -2.0, 'Destination Hub (Core Cluster)', true);

    this.addEdge(src.id, mid.id, 2.0); // Dominant central artery
    this.addEdge(mid.id, dst.id, 2.0);

    this.addEdge(src.id, top.id, 0.5); // Backup upper path
    this.addEdge(top.id, dst.id, 0.5);

    this.addEdge(src.id, bot.id, 0.5); // Backup lower path
    this.addEdge(bot.id, dst.id, 0.5);

    this.addEdge(top.id, mid.id, 0.2); // Cross ties
    this.addEdge(mid.id, bot.id, 0.2);

    this.updateFluxes();
  }
}
