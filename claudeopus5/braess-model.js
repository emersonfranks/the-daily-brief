// @ts-check

/**
 * Two potential-minimising systems that share one paradox.
 *
 * A. A four-node road network played as a congestion game. Drivers are selfish,
 *    so the resting state is a Nash equilibrium, which Rosenthal (1973) showed is
 *    exactly a local minimum of a potential function.
 * B. A vertical rig of two springs and three strings. The resting state is the
 *    minimum of elastic-plus-gravitational potential energy.
 *
 * Neither potential is the quantity a human cares about (mean commute; how high
 * the weight hangs), which is why removing a connection can improve the outcome.
 */

/**
 * @typedef {object} RoadParams
 * @property {number} capacity Congested-edge latency is `flow / capacity` minutes.
 * @property {number} fixedCost Minutes on each uncongested edge, regardless of flow.
 */

/** @type {RoadParams} */
export const DEFAULT_ROAD = { capacity: 100, fixedCost: 45 };

/**
 * Route indices. R1 and R2 are the two original commutes; R3 uses the shortcut
 * and therefore touches both congested edges.
 */
export const ROUTE_TOP = 0;
export const ROUTE_BOTTOM = 1;
export const ROUTE_SHORTCUT = 2;

/**
 * @typedef {object} RoadState
 * @property {[number, number, number]} counts Drivers on each route.
 * @property {boolean} shortcutOpen
 * @property {RoadParams} params
 */

/**
 * @param {number} drivers
 * @param {boolean} shortcutOpen
 * @param {RoadParams} [params]
 * @returns {RoadState}
 */
export function createRoadState(drivers, shortcutOpen, params = DEFAULT_ROAD) {
  const top = Math.floor(drivers / 2);
  return {
    counts: [top, drivers - top, 0],
    shortcutOpen,
    params,
  };
}

/**
 * Flow on each of the two congested edges. Route 3 loads both of them.
 * @param {readonly [number, number, number]} counts
 * @returns {{ startToA: number, bToEnd: number }}
 */
export function edgeFlows(counts) {
  return {
    startToA: counts[ROUTE_TOP] + counts[ROUTE_SHORTCUT],
    bToEnd: counts[ROUTE_BOTTOM] + counts[ROUTE_SHORTCUT],
  };
}

/**
 * Travel time in minutes on each route, given the current loading.
 * @param {readonly [number, number, number]} counts
 * @param {RoadParams} params
 * @returns {[number, number, number]}
 */
export function routeCosts(counts, params) {
  const { startToA, bToEnd } = edgeFlows(counts);
  const congestedTop = startToA / params.capacity;
  const congestedBottom = bToEnd / params.capacity;
  return [
    congestedTop + params.fixedCost,
    params.fixedCost + congestedBottom,
    congestedTop + congestedBottom,
  ];
}

/**
 * Mean travel time across all drivers — the quantity a commuter actually cares
 * about, and the one nothing in the system is trying to minimise.
 * @param {RoadState} state
 * @returns {number}
 */
export function meanTravelTime(state) {
  const total = state.counts[0] + state.counts[1] + state.counts[2];
  if (total === 0) return 0;
  const costs = routeCosts(state.counts, state.params);
  let sum = 0;
  for (let i = 0; i < 3; i++) sum += costs[i] * state.counts[i];
  return sum / total;
}

/**
 * Rosenthal's potential: for each edge, sum its latency over every unit of flow
 * from 1 to x. A congested edge with latency x/c contributes x(x+1)/(2c).
 *
 * This is the function selfish routing actually descends. Every unilateral
 * improving switch lowers it by exactly the switcher's own saving, which is why
 * pure Nash equilibria exist at all.
 * @param {RoadState} state
 * @returns {number}
 */
export function rosenthalPotential(state) {
  const { capacity, fixedCost } = state.params;
  const { startToA, bToEnd } = edgeFlows(state.counts);
  const congested = (x) => (x * (x + 1)) / (2 * capacity);
  return (
    congested(startToA) +
    congested(bToEnd) +
    fixedCost * state.counts[ROUTE_TOP] +
    fixedCost * state.counts[ROUTE_BOTTOM]
  );
}

/** @param {RoadState} state @returns {number[]} */
function openRoutes(state) {
  return state.shortcutOpen ? [0, 1, 2] : [0, 1];
}

/**
 * Move one driver to a strictly cheaper route, evaluating the destination's cost
 * as it will be once that driver has arrived. Returns null once nobody can improve,
 * which is the definition of Nash equilibrium.
 * @param {RoadState} state
 * @returns {{ from: number, to: number, saving: number } | null}
 */
export function findImprovingMove(state) {
  const routes = openRoutes(state);
  const costs = routeCosts(state.counts, state.params);
  let best = null;
  for (const from of routes) {
    if (state.counts[from] === 0) continue;
    for (const to of routes) {
      if (to === from) continue;
      /** @type {[number, number, number]} */
      const probe = [state.counts[0], state.counts[1], state.counts[2]];
      probe[from] -= 1;
      probe[to] += 1;
      const saving = costs[from] - routeCosts(probe, state.params)[to];
      if (saving > 1e-9 && (best === null || saving > best.saving)) {
        best = { from, to, saving };
      }
    }
  }
  return best;
}

/**
 * Best-response dynamics: hand one driver at a time their best switch until none
 * exists. Records the potential and the mean travel time at every step so the two
 * can be plotted against each other.
 *
 * @param {RoadState} state Mutated in place.
 * @param {number} [maxSteps]
 * @returns {{ steps: number, converged: boolean, trace: Array<{ step: number, potential: number, meanTime: number, counts: [number, number, number] }> }}
 */
export function relaxRoads(state, maxSteps = 200000) {
  const trace = [
    {
      step: 0,
      potential: rosenthalPotential(state),
      meanTime: meanTravelTime(state),
      counts: /** @type {[number, number, number]} */ ([...state.counts]),
    },
  ];
  let steps = 0;
  while (steps < maxSteps) {
    const move = findImprovingMove(state);
    if (move === null) break;
    state.counts[move.from] -= 1;
    state.counts[move.to] += 1;
    steps++;
    if (steps % 25 === 0 || steps < 25) {
      trace.push({
        step: steps,
        potential: rosenthalPotential(state),
        meanTime: meanTravelTime(state),
        counts: /** @type {[number, number, number]} */ ([...state.counts]),
      });
    }
  }
  trace.push({
    step: steps,
    potential: rosenthalPotential(state),
    meanTime: meanTravelTime(state),
    counts: /** @type {[number, number, number]} */ ([...state.counts]),
  });
  return { steps, converged: findImprovingMove(state) === null, trace };
}

/**
 * Closed-form equilibrium commute, derived by hand from the three regimes of the
 * network. Used only to check the simulation, never to drive the page.
 *
 * With the shortcut shut, demand splits evenly. With it open there are three
 * regimes: everyone funnels through the shortcut; a mixed equilibrium pinned at
 * twice the fixed cost; and finally demand so heavy the shortcut is abandoned.
 * @param {number} drivers
 * @param {boolean} shortcutOpen
 * @param {RoadParams} [params]
 * @returns {number}
 */
export function analyticEquilibriumCost(drivers, shortcutOpen, params = DEFAULT_ROAD) {
  const { capacity, fixedCost } = params;
  const split = drivers / (2 * capacity) + fixedCost;
  if (!shortcutOpen) return split;
  if (drivers <= fixedCost * capacity) return (2 * drivers) / capacity;
  if (drivers < 2 * fixedCost * capacity) return 2 * fixedCost;
  return split;
}

/**
 * Minutes added to every commute by opening the shortcut. Negative means the
 * shortcut genuinely helps.
 * @param {number} drivers
 * @param {RoadParams} [params]
 * @returns {number}
 */
export function analyticHarm(drivers, params = DEFAULT_ROAD) {
  return (
    analyticEquilibriumCost(drivers, true, params) -
    analyticEquilibriumCost(drivers, false, params)
  );
}

/**
 * The demand window inside which Braess's paradox occurs at all, in closed form.
 * Below the lower bound the shortcut is a genuine improvement; above the upper
 * bound it is congested enough that nobody uses it.
 * @param {RoadParams} [params]
 * @returns {{ lower: number, upper: number, peakDrivers: number, peakHarm: number }}
 */
export function braessWindow(params = DEFAULT_ROAD) {
  const { capacity, fixedCost } = params;
  const lower = (2 * fixedCost * capacity) / 3;
  const upper = 2 * fixedCost * capacity;
  const peakDrivers = fixedCost * capacity;
  return { lower, upper, peakDrivers, peakHarm: analyticHarm(peakDrivers, params) };
}

/**
 * @typedef {object} RigParams
 * @property {number} springRest Unloaded length of each spring, in cm.
 * @property {number} stiffness Spring constant, N/cm.
 * @property {number} linkLength Length of the string joining the two springs, cm.
 * @property {number} safetyLength Length of each of the two side strings, cm.
 * @property {number} load Weight hung from the bottom, in newtons.
 * @property {number} stringStiffness Strings resist stretching only, this stiffly.
 */

/** @type {RigParams} */
export const DEFAULT_RIG = {
  springRest: 10,
  stiffness: 0.25,
  linkLength: 2,
  safetyLength: 56,
  load: 10,
  stringStiffness: 400,
};

/**
 * Positions are depths below the ceiling, in cm, so larger means lower.
 * @typedef {object} RigState
 * @property {number} lowerSpringTop Bottom of the upper spring.
 * @property {number} upperSpringBottom Top of the lower spring.
 * @property {number} weight
 * @property {boolean} linkIntact
 * @property {RigParams} params
 */

/**
 * @param {boolean} linkIntact
 * @param {RigParams} [params]
 * @returns {RigState}
 */
export function createRigState(linkIntact, params = DEFAULT_RIG) {
  return {
    lowerSpringTop: params.springRest,
    upperSpringBottom: params.springRest + params.linkLength,
    weight: 2 * params.springRest + params.linkLength,
    linkIntact,
    params,
  };
}

/**
 * Tension in each element at the current geometry. Strings pull but never push,
 * so a slack string contributes exactly nothing.
 * @param {RigState} state
 * @returns {{ upperSpring: number, lowerSpring: number, link: number, safetyTop: number, safetyBottom: number }}
 */
export function rigTensions(state) {
  const p = state.params;
  const slackAware = (extension) => (extension > 0 ? p.stringStiffness * extension : 0);
  return {
    upperSpring: p.stiffness * (state.lowerSpringTop - p.springRest),
    lowerSpring: p.stiffness * (state.weight - state.upperSpringBottom - p.springRest),
    link: state.linkIntact
      ? slackAware(state.upperSpringBottom - state.lowerSpringTop - p.linkLength)
      : 0,
    safetyTop: slackAware(state.upperSpringBottom - p.safetyLength),
    safetyBottom: slackAware(state.weight - state.lowerSpringTop - p.safetyLength),
  };
}

/**
 * Total potential energy: elastic energy stored in every taut element, minus the
 * work gravity has already done on the weight.
 * @param {RigState} state
 * @returns {number}
 */
export function rigEnergy(state) {
  const p = state.params;
  const spring = (extension) => 0.5 * p.stiffness * extension * extension;
  const string = (extension) =>
    extension > 0 ? 0.5 * p.stringStiffness * extension * extension : 0;
  let total = spring(state.lowerSpringTop - p.springRest);
  total += spring(state.weight - state.upperSpringBottom - p.springRest);
  if (state.linkIntact) {
    total += string(state.upperSpringBottom - state.lowerSpringTop - p.linkLength);
  }
  total += string(state.upperSpringBottom - p.safetyLength);
  total += string(state.weight - state.lowerSpringTop - p.safetyLength);
  return total - p.load * state.weight;
}

/**
 * Net downward force on each free node — the negative gradient of the energy.
 * @param {RigState} state
 * @returns {[number, number, number]}
 */
export function rigForces(state) {
  const t = rigTensions(state);
  return [
    t.link + t.safetyBottom - t.upperSpring,
    t.lowerSpring - t.link - t.safetyTop,
    state.params.load - t.lowerSpring - t.safetyBottom,
  ];
}

/**
 * Settle the rig by descending its potential energy, with heavy-ball momentum so
 * the soft spring modes do not take forever. Step size is bounded by the stiffest
 * element, which is always a string.
 *
 * @param {RigState} state Mutated in place.
 * @param {number} [iterations] Measured: 4000 leaves a 0.18 cm error, 8000 leaves
 *   0.0005 cm, 16000 converges to 2.4e-10 N of residual force. 16000 it is.
 * @returns {{ residual: number, energy: number, iterations: number }}
 */
export function relaxRig(state, iterations = 16000) {
  const step = 0.8 / state.params.stringStiffness;
  const momentum = 0.9;
  let vP = 0;
  let vQ = 0;
  let vW = 0;
  for (let i = 0; i < iterations; i++) {
    const [fP, fQ, fW] = rigForces(state);
    vP = momentum * vP + step * fP;
    vQ = momentum * vQ + step * fQ;
    vW = momentum * vW + step * fW;
    state.lowerSpringTop += vP;
    state.upperSpringBottom += vQ;
    state.weight += vW;
  }
  const forces = rigForces(state);
  return {
    residual: Math.max(Math.abs(forces[0]), Math.abs(forces[1]), Math.abs(forces[2])),
    energy: rigEnergy(state),
    iterations,
  };
}

/**
 * Settle the rig both with and without the link and report what cutting it does.
 * A positive `rise` means the weight ended up higher after the string was cut.
 * @param {RigParams} [params]
 * @returns {{ linkedDepth: number, cutDepth: number, rise: number, linkedEnergy: number, cutEnergy: number, worstResidual: number }}
 */
export function compareRig(params = DEFAULT_RIG) {
  const linked = createRigState(true, params);
  const cut = createRigState(false, params);
  const a = relaxRig(linked);
  const b = relaxRig(cut);
  return {
    linkedDepth: linked.weight,
    cutDepth: cut.weight,
    rise: linked.weight - cut.weight,
    linkedEnergy: a.energy,
    cutEnergy: b.energy,
    worstResidual: Math.max(a.residual, b.residual),
  };
}
