// @ts-check

/**
 * Domain module. Pure maths on graphs — no DOM, no canvas, no globals, so the
 * whole thing can be run headlessly by `node --test` and by the browser alike.
 *
 * The systems being compared:
 *
 *   A. An attention-starved social network. Each person splits attention over
 *      the ties they have as 1/(k + a), and a shared activity only happens when
 *      that share clears a threshold *and* the partner is judged likely enough
 *      to show up. Nobody is removed. Ties simply stop happening.
 *
 *   B. The same network under a deliberate attack that deletes its
 *      highest-degree nodes, one after another.
 *
 *   C. The control: the same number of nodes deleted at random.
 */

/** @typedef {{ n: number, edges: Array<[number, number]>, degree: number[], adj: number[][] }} Graph */

/**
 * Deterministic PRNG (mulberry32). Every figure on the page is reproducible
 * from a seed, which is the only reason a claim about a random graph means
 * anything.
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Barabasi-Albert preferential attachment. Produces the heavy-tailed degree
 * distribution that makes the hub-attack contrast meaningful; on a homogeneous
 * random graph the whole comparison would be uninteresting because there are no
 * hubs to lose.
 * @param {number} n total nodes
 * @param {number} m edges added per new node
 * @param {() => number} rng
 * @returns {Graph}
 */
export function scaleFreeGraph(n, m, rng) {
  if (n <= m + 1) throw new Error('n must exceed m + 1');
  /** @type {Array<[number, number]>} */
  const edges = [];
  /** @type {number[]} */
  const targets = [];

  for (let i = 0; i <= m; i++) {
    for (let j = i + 1; j <= m; j++) {
      edges.push([i, j]);
      targets.push(i, j);
    }
  }

  for (let v = m + 1; v < n; v++) {
    /** @type {Set<number>} */
    const chosen = new Set();
    let guard = 0;
    while (chosen.size < m && guard < 10000) {
      guard++;
      const pick = targets[Math.floor(rng() * targets.length)];
      if (pick !== v) chosen.add(pick);
    }
    for (const u of chosen) {
      edges.push([u, v]);
      targets.push(u, v);
    }
  }

  return finalise(n, edges);
}

/**
 * @param {number} n
 * @param {Array<[number, number]>} edges
 * @returns {Graph}
 */
function finalise(n, edges) {
  const degree = new Array(n).fill(0);
  /** @type {number[][]} */
  const adj = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    degree[u]++;
    degree[v]++;
    adj[u].push(v);
    adj[v].push(u);
  }
  return { n, edges, degree, adj };
}

/**
 * @param {number[]} degrees
 * @returns {number}
 */
export function meanDegree(degrees) {
  if (degrees.length === 0) return 0;
  return degrees.reduce((s, d) => s + d, 0) / degrees.length;
}

/**
 * The Molloy-Reed ratio, kappa = <k^2>/<k>. A random graph with a given degree
 * sequence has a giant component when kappa > 2 and loses it when kappa falls
 * to 2. This is the single number that both halves of the pairing are
 * ultimately about.
 * @param {number[]} degrees degree sequence of the *surviving* nodes
 * @returns {number}
 */
export function kappa(degrees) {
  if (degrees.length === 0) return 0;
  let s1 = 0;
  let s2 = 0;
  for (const d of degrees) {
    s1 += d;
    s2 += d * d;
  }
  if (s1 === 0) return 0;
  return s2 / s1;
}

/**
 * Largest connected component, measured over a subset of live nodes and live
 * edges. The denominator is always the original node count, so the three
 * conditions are directly comparable.
 * @param {Graph} graph
 * @param {(nodeIndex: number) => boolean} nodeAlive
 * @param {(edgeIndex: number) => boolean} edgeAlive
 * @returns {{ fraction: number, size: number, componentOf: Int32Array }}
 */
export function giantComponent(graph, nodeAlive, edgeAlive) {
  const { n, edges } = graph;
  /** @type {number[][]} */
  const live = Array.from({ length: n }, () => []);
  for (let e = 0; e < edges.length; e++) {
    if (!edgeAlive(e)) continue;
    const [u, v] = edges[e];
    if (!nodeAlive(u) || !nodeAlive(v)) continue;
    live[u].push(v);
    live[v].push(u);
  }

  const componentOf = new Int32Array(n).fill(-1);
  let best = 0;
  let bestId = -1;
  let id = 0;
  const stack = new Int32Array(n);

  for (let start = 0; start < n; start++) {
    if (!nodeAlive(start) || componentOf[start] !== -1) continue;
    let top = 0;
    stack[top++] = start;
    componentOf[start] = id;
    let size = 0;
    while (top > 0) {
      const node = stack[--top];
      size++;
      for (const nb of live[node]) {
        if (componentOf[nb] === -1) {
          componentOf[nb] = id;
          stack[top++] = nb;
        }
      }
    }
    if (size > best) {
      best = size;
      bestId = id;
    }
    id++;
  }

  for (let i = 0; i < n; i++) {
    if (componentOf[i] !== bestId) componentOf[i] = -1;
  }
  return { fraction: best / n, size: best, componentOf };
}

/**
 * System A. No node is removed and no attacker exists.
 *
 * Each person spreads attention over their ties as s_i = 1/(k_i + a). A shared
 * activity on the tie (i, j) happens only when i's share, discounted by how
 * reliable j currently looks, clears the threshold theta — and symmetrically
 * for j. Reliability q_j is the fraction of j's ties still active, so ties
 * dying makes partners look less reliable, which kills further ties. The
 * process is monotone (a dead tie never revives), so it converges.
 *
 * Capacity is the reader-facing control: setting theta = 1/(capacity + a) means
 * that on the very first round a tie needs k_i <= capacity at both ends. The
 * cascade then goes wherever it goes, and how much further it reaches than that
 * first round is a measurement, not an assumption.
 *
 * @param {Graph} graph
 * @param {number} capacity
 * @param {number} a attention offset (the `a` in 1/(k + a))
 * @param {number} [maxRounds]
 * @returns {{ edgeActive: boolean[], activeDegree: number[], solitary: number[], firstRoundLosers: number[], rounds: number, converged: boolean }}
 */
export function attentionCascade(graph, capacity, a, maxRounds = 500) {
  const { n, edges, degree } = graph;
  const theta = 1 / (capacity + a);
  const share = degree.map((k) => 1 / (k + a));

  const edgeActive = new Array(edges.length).fill(true);
  const activeDegree = degree.slice();

  const firstRoundLosers = [];
  for (let i = 0; i < n; i++) {
    if (share[i] < theta) firstRoundLosers.push(i);
  }

  let rounds = 0;
  let converged = false;
  while (rounds < maxRounds) {
    rounds++;
    /** @type {number[]} */
    const doomed = [];
    for (let e = 0; e < edges.length; e++) {
      if (!edgeActive[e]) continue;
      const [u, v] = edges[e];
      const qu = degree[u] === 0 ? 0 : activeDegree[u] / degree[u];
      const qv = degree[v] === 0 ? 0 : activeDegree[v] / degree[v];
      if (share[u] * qv < theta || share[v] * qu < theta) doomed.push(e);
    }
    if (doomed.length === 0) {
      converged = true;
      break;
    }
    for (const e of doomed) {
      edgeActive[e] = false;
      activeDegree[edges[e][0]]--;
      activeDegree[edges[e][1]]--;
    }
  }

  /** @type {number[]} */
  const solitary = [];
  for (let i = 0; i < n; i++) {
    if (activeDegree[i] === 0 && degree[i] > 0) solitary.push(i);
  }

  return { edgeActive, activeDegree, solitary, firstRoundLosers, rounds, converged };
}

/**
 * System B. An attacker deletes the `count` highest-degree nodes. Ties are
 * broken by node index so the result is deterministic.
 * @param {Graph} graph
 * @param {number} count
 * @returns {number[]} removed node indices
 */
export function hubAttack(graph, count) {
  const order = graph.degree
    .map((d, i) => ({ d, i }))
    .sort((x, y) => (y.d - x.d) || (x.i - y.i));
  return order.slice(0, Math.max(0, Math.min(count, graph.n))).map((o) => o.i);
}

/**
 * The control. Same number of nodes, chosen without regard to degree.
 * @param {Graph} graph
 * @param {number} count
 * @param {() => number} rng
 * @returns {number[]}
 */
export function randomFailure(graph, count, rng) {
  const idx = Array.from({ length: graph.n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx.slice(0, Math.max(0, Math.min(count, graph.n)));
}
/**
 * Giant component after deleting a set of nodes outright.
 * @param {Graph} graph
 * @param {number[]} removed
 * @returns {{ fraction: number, size: number, componentOf: Int32Array, survivingDegrees: number[] }}
 */
export function componentAfterRemoval(graph, removed) {
  const dead = new Uint8Array(graph.n);
  for (const r of removed) dead[r] = 1;
  const res = giantComponent(graph, (i) => dead[i] === 0, () => true);

  /** @type {number[]} */
  const survivingDegrees = [];
  for (let i = 0; i < graph.n; i++) {
    if (dead[i]) continue;
    let d = 0;
    for (const nb of graph.adj[i]) if (!dead[nb]) d++;
    survivingDegrees.push(d);
  }
  return { ...res, survivingDegrees };
}

/**
 * The three-way comparison at one capacity setting, all matched on the *same
 * number of people going silent*.
 *
 * The attention side removes nobody: it is the graph of ties that are still
 * active at the cascade's fixed point. The other two delete that same number of
 * nodes outright — the highest-degree ones for the attack, and an average over
 * several independent draws for the random control, so the control is not one
 * lucky shuffle.
 *
 * `attackLikeness` places the attention result on the line between the two
 * controls: 0 means indistinguishable from random dropout, 1 means
 * indistinguishable from a targeted strike on the hubs. It is `null` when the
 * two controls are too close together for the position between them to mean
 * anything.
 *
 * @param {Graph} graph
 * @param {number} capacity
 * @param {number} a
 * @param {number} controlSeed
 * @param {number} [controlReplicates]
 */
export function compareAtCapacity(graph, capacity, a, controlSeed, controlReplicates = 5) {
  const cascade = attentionCascade(graph, capacity, a);
  const quietCount = cascade.solitary.length;
  const overCapacity = cascade.firstRoundLosers;

  const attention = giantComponent(
    graph,
    (i) => cascade.activeDegree[i] > 0,
    (e) => cascade.edgeActive[e],
  );

  const attackRemoved = hubAttack(graph, quietCount);
  const attack = componentAfterRemoval(graph, attackRemoved);

  /** @type {number[]} */
  const controlFractions = [];
  /** @type {number[]} */
  let firstControlRemoved = [];
  for (let r = 0; r < controlReplicates; r++) {
    const removed = randomFailure(graph, quietCount, makeRng(controlSeed + r * 1013));
    if (r === 0) firstControlRemoved = removed;
    controlFractions.push(componentAfterRemoval(graph, removed).fraction);
  }
  const controlFraction =
    controlFractions.reduce((s, x) => s + x, 0) / controlFractions.length;

  // The attack matched on the *cutoff* instead of the count: delete exactly the
  // people who are over their limit. This is the comparison the source preprint's
  // truncated-second-moment statement is about, and it is reported separately
  // because it does not agree with the cascade.
  const cutoffAttack = componentAfterRemoval(graph, overCapacity);

  /** @type {number[]} */
  const attentionSurvivingDegrees = [];
  for (let i = 0; i < graph.n; i++) {
    if (cascade.activeDegree[i] > 0) attentionSurvivingDegrees.push(cascade.activeDegree[i]);
  }

  const spread = controlFraction - attack.fraction;
  const attackLikeness = spread > 0.05 ? (controlFraction - attention.fraction) / spread : null;

  return {
    capacity,
    cascade,
    quietCount,
    overCapacityCount: overCapacity.length,
    attentionFraction: attention.fraction,
    attentionComponentOf: attention.componentOf,
    attackFraction: attack.fraction,
    attackRemoved,
    attackComponentOf: attack.componentOf,
    controlFraction,
    controlSpread: Math.max(...controlFractions) - Math.min(...controlFractions),
    controlRemoved: firstControlRemoved,
    controlComponentOf: componentAfterRemoval(graph, firstControlRemoved).componentOf,
    cutoffAttackFraction: cutoffAttack.fraction,
    attackLikeness,
    kappaAttention: kappa(attentionSurvivingDegrees),
    kappaAttack: kappa(attack.survivingDegrees),
  };
}

/**
 * @typedef {{ capacity: number, quietCount: number, quietFraction: number,
 *   overCapacityCount: number, attention: number, attack: number, control: number,
 *   controlSpread: number, cutoffAttack: number, attackLikeness: number | null,
 *   kappaAttention: number, kappaAttack: number, rounds: number, converged: boolean }} SweepRow
 */

/**
 * Sweep capacity from high to low and record all three curves. This is what the
 * chart draws and what most of the claims are checked against.
 * @param {Graph} graph
 * @param {number[]} capacities descending
 * @param {number} a
 * @param {number} controlSeed
 * @returns {SweepRow[]}
 */
export function sweep(graph, capacities, a, controlSeed) {
  return capacities.map((c) => {
    const r = compareAtCapacity(graph, c, a, controlSeed);
    return {
      capacity: c,
      quietCount: r.quietCount,
      quietFraction: r.quietCount / graph.n,
      overCapacityCount: r.overCapacityCount,
      attention: r.attentionFraction,
      attack: r.attackFraction,
      control: r.controlFraction,
      controlSpread: r.controlSpread,
      cutoffAttack: r.cutoffAttackFraction,
      attackLikeness: r.attackLikeness,
      kappaAttention: r.kappaAttention,
      kappaAttack: r.kappaAttack,
      rounds: r.cascade.rounds,
      converged: r.cascade.converged,
    };
  });
}

/** Standard build used by the page, the calibration script and the test suite. */
export const CONFIG = Object.freeze({
  n: 300,
  m: 2,
  a: 1,
  graphSeed: 20260903,
  controlSeed: 77,
  /** Seeds the claim suite re-runs every check against, so no single graph carries a result. */
  auditSeeds: Object.freeze([20260903, 11, 12345, 987654, 555]),
  capacities: Object.freeze(Array.from({ length: 38 }, (_, i) => 40 - i)),
});

/**
 * @param {number} [seed]
 * @returns {Graph}
 */
export function standardGraph(seed = CONFIG.graphSeed) {
  return scaleFreeGraph(CONFIG.n, CONFIG.m, makeRng(seed));
}
