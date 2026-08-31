// @ts-check

/**
 * @fileoverview Domain simulation module for Rate-Distortion Allostatic Categorization.
 * Implements the Blahut-Arimoto algorithm for Information Bottleneck / Rate-Distortion theory,
 * modeling how both cortical predictive coding under metabolic constraints and digital codecs
 * under bandwidth limits undergo categorical phase transitions (bifurcations).
 *
 * PURE DOMAIN LOGIC: Zero DOM dependencies, fully headless and testable.
 */

/**
 * @typedef {Object} Stimulus
 * @property {number} id
 * @property {string} label
 * @property {number[]} features - Multi-dimensional feature vector [e.g. frequency, intensity, motion]
 * @property {number} prior - Probability of occurrence p(x)
 * @property {boolean} isThreat - Biological threat tag for asymmetric cost
 */

/**
 * @typedef {Object} CodebookState
 * @property {number} beta - Lagrange multiplier / inverse temperature (allostatic pressure / channel rate)
 * @property {number} rate - Mutual information I(X; X_hat) in bits
 * @property {number} distortion - Expected distortion E[d(x, x_hat)]
 * @property {number[][]} conditionalProb - p(x_hat | x) matrix
 * @property {number[]} clusterPriors - p(x_hat) vector
 * @property {number[][]} centroids - Position of each codebook centroid in feature space
 * @property {number} effectiveClusters - Count of active clusters with p(x_hat) > threshold
 * @property {number} asymmetricRisk - Survival penalty / false negative risk under asymmetric cost
 */

/**
 * Default synthetic sensory environment / signal space.
 * 8 distinct environmental signals clustered into 3 natural groups (threat, resource, ambient noise).
 * @type {Stimulus[]}
 */
export const DEFAULT_STIMULI = [
  // Cluster 1: Ambient / benign cues (low intensity, high frequency, slow motion)
  { id: 0, label: 'Wind Rustle', features: [0.15, 0.20, 0.10], prior: 0.20, isThreat: false },
  { id: 1, label: 'Falling Leaf', features: [0.20, 0.15, 0.12], prior: 0.15, isThreat: false },
  { id: 2, label: 'Distant Stream', features: [0.18, 0.28, 0.08], prior: 0.15, isThreat: false },
  
  // Cluster 2: Nutrient / resource cues (mid intensity, mid frequency, moderate motion)
  { id: 3, label: 'Ripe Berry Swarm', features: [0.60, 0.55, 0.40], prior: 0.15, isThreat: false },
  { id: 4, label: 'Edible Insect Call', features: [0.65, 0.60, 0.45], prior: 0.10, isThreat: false },
  
  // Cluster 3: Predator / acute threat cues (high intensity, low frequency rumble, rapid motion)
  { id: 5, label: 'Predator Stalk Step', features: [0.85, 0.80, 0.88], prior: 0.10, isThreat: true },
  { id: 6, label: 'Viper Strike Hiss', features: [0.90, 0.85, 0.92], prior: 0.08, isThreat: true },
  { id: 7, label: 'Raptor Shadow Swoop', features: [0.95, 0.78, 0.95], prior: 0.07, isThreat: true },
];

/**
 * Compute squared Euclidean distance between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function euclideanDistanceSq(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Compute asymmetric survival distortion between stimulus x and representation centroid x_hat.
 * In biology, false negatives on lethal threats carry catastrophic metabolic cost.
 * In codecs, dropouts on essential keyframe headers carry catastrophic perceptual distortion.
 *
 * @param {Stimulus} x
 * @param {number[]} xHatFeatures
 * @param {number} asymmetryFactor - Multiplier for critical signal misclassification (default: 1.0 = symmetric)
 * @returns {number}
 */
export function calculateDistortion(x, xHatFeatures, asymmetryFactor = 1.0) {
  const baseDist = euclideanDistanceSq(x.features, xHatFeatures);
  if (x.isThreat && asymmetryFactor > 1.0) {
    // If stimulus is a threat but representation centroid is far in feature space (classified as benign)
    const centroidThreatScore = xHatFeatures[0]; // High index 0 implies threat-like centroid
    const threatOmission = Math.max(0, 0.8 - centroidThreatScore);
    return baseDist + threatOmission * asymmetryFactor;
  }
  return baseDist;
}

/**
 * Run Blahut-Arimoto iterative rate-distortion optimization for a given beta and candidate centroids.
 *
 * @param {Stimulus[]} stimuli - Array of input stimuli with priors
 * @param {number} beta - Rate-distortion trade-off parameter (1/T)
 * @param {number} numCentroids - Number of candidate representation states (e.g. 6)
 * @param {number} [asymmetryFactor=1.0] - Asymmetric loss weighting
 * @param {number} [maxIters=100] - Max iterations
 * @param {number} [tol=1e-6] - Convergence tolerance
 * @returns {CodebookState}
 */
export function optimizeRateDistortion(
  stimuli = DEFAULT_STIMULI,
  beta = 2.0,
  numCentroids = 6,
  asymmetryFactor = 1.0,
  maxIters = 100,
  tol = 1e-6
) {
  const numStimuli = stimuli.length;
  const numDims = stimuli[0].features.length;

  // Initialize centroids spread across feature space with slight deterministic perturbation
  /** @type {number[][]} */
  let centroids = [];
  for (let k = 0; k < numCentroids; k++) {
    const frac = (k + 0.5) / numCentroids;
    const c = [];
    for (let d = 0; d < numDims; d++) {
      c.push(0.1 + 0.8 * frac + 0.05 * Math.sin(k * 2.3 + d * 1.7));
    }
    centroids.push(c);
  }

  // Initialize marginal distribution p(x_hat) uniformly
  let pXHat = new Array(numCentroids).fill(1 / numCentroids);

  // Conditional probability matrix p(x_hat | x): size [numStimuli][numCentroids]
  /** @type {number[][]} */
  let pXHatGivenX = Array.from({ length: numStimuli }, () => new Array(numCentroids).fill(1 / numCentroids));

  // Blahut-Arimoto alternating optimization loop
  for (let iter = 0; iter < maxIters; iter++) {
    const prevPXHat = [...pXHat];

    // Step 1: Update conditional distributions p(x_hat | x)
    // p(x_hat | x) = p(x_hat) * exp(-beta * d(x, x_hat)) / Z(x)
    for (let i = 0; i < numStimuli; i++) {
      const stim = stimuli[i];
      let z = 0;
      const unnorm = new Array(numCentroids);
      for (let k = 0; k < numCentroids; k++) {
        const d = calculateDistortion(stim, centroids[k], asymmetryFactor);
        const val = pXHat[k] * Math.exp(-beta * d);
        unnorm[k] = val;
        z += val;
      }

      for (let k = 0; k < numCentroids; k++) {
        pXHatGivenX[i][k] = z > 1e-15 ? unnorm[k] / z : 1 / numCentroids;
      }
    }

    // Step 2: Update representation marginals p(x_hat) = sum_x p(x) * p(x_hat | x)
    for (let k = 0; k < numCentroids; k++) {
      let sum = 0;
      for (let i = 0; i < numStimuli; i++) {
        sum += stimuli[i].prior * pXHatGivenX[i][k];
      }
      pXHat[k] = sum;
    }

    // Step 3: Update centroid locations x_hat = sum_x p(x, x_hat) * x / p(x_hat)
    for (let k = 0; k < numCentroids; k++) {
      if (pXHat[k] > 1e-6) {
        for (let d = 0; d < numDims; d++) {
          let num = 0;
          for (let i = 0; i < numStimuli; i++) {
            num += stimuli[i].prior * pXHatGivenX[i][k] * stimuli[i].features[d];
          }
          centroids[k][d] = num / pXHat[k];
        }
      }
    }

    // Check convergence
    let maxChange = 0;
    for (let k = 0; k < numCentroids; k++) {
      const diff = Math.abs(pXHat[k] - prevPXHat[k]);
      if (diff > maxChange) maxChange = diff;
    }
    if (maxChange < tol) break;
  }

  // Calculate Information Rate R = I(X; X_hat) in bits
  let rate = 0;
  for (let i = 0; i < numStimuli; i++) {
    const pX = stimuli[i].prior;
    for (let k = 0; k < numCentroids; k++) {
      const cond = pXHatGivenX[i][k];
      const marg = pXHat[k];
      if (cond > 1e-12 && marg > 1e-12) {
        rate += pX * cond * Math.log2(cond / marg);
      }
    }
  }

  // Calculate Expected Distortion D = sum_x sum_xhat p(x) p(x_hat|x) d(x, x_hat)
  let distortion = 0;
  let asymmetricRisk = 0;
  for (let i = 0; i < numStimuli; i++) {
    const stim = stimuli[i];
    for (let k = 0; k < numCentroids; k++) {
      const prob = stim.prior * pXHatGivenX[i][k];
      const d = calculateDistortion(stim, centroids[k], asymmetryFactor);
      distortion += prob * d;

      if (stim.isThreat) {
        const centroidThreatScore = centroids[k][0];
        if (centroidThreatScore < 0.6) {
          asymmetricRisk += prob * (0.8 - centroidThreatScore);
        }
      }
    }
  }

  // Identify unique active clusters by merging centroids that have converged to within epsilon distance
  /** @type {{ centroid: number[], prob: number }[]} */
  const distinctClusters = [];
  for (let k = 0; k < numCentroids; k++) {
    if (pXHat[k] >= 0.02) {
      // Check if this centroid is already merged into an existing cluster
      let merged = false;
      for (const cl of distinctClusters) {
        if (euclideanDistanceSq(centroids[k], cl.centroid) < 0.01) {
          cl.prob += pXHat[k];
          merged = true;
          break;
        }
      }
      if (!merged) {
        distinctClusters.push({ centroid: [...centroids[k]], prob: pXHat[k] });
      }
    }
  }

  const activeClusterCount = distinctClusters.length;

  return {
    beta,
    rate: Math.max(0, rate),
    distortion,
    conditionalProb: pXHatGivenX,
    clusterPriors: pXHat,
    centroids,
    effectiveClusters: activeClusterCount,
    asymmetricRisk,
  };
}

/**
 * Sweep beta values across a range to construct the full Rate-Distortion curve and detect bifurcation points.
 *
 * @param {Stimulus[]} [stimuli=DEFAULT_STIMULI]
 * @param {number} [minBeta=0.1]
 * @param {number} [maxBeta=30.0]
 * @param {number} [steps=40]
 * @param {number} [asymmetry=1.0]
 * @returns {CodebookState[]}
 */
export function sweepRateDistortionCurve(
  stimuli = DEFAULT_STIMULI,
  minBeta = 0.1,
  maxBeta = 30.0,
  steps = 40,
  asymmetry = 1.0
) {
  const curve = [];
  const logMin = Math.log10(minBeta);
  const logMax = Math.log10(maxBeta);
  const stepSize = (logMax - logMin) / (steps - 1);

  for (let s = 0; s < steps; s++) {
    const beta = Math.pow(10, logMin + s * stepSize);
    const state = optimizeRateDistortion(stimuli, beta, 6, asymmetry);
    curve.push(state);
  }

  return curve;
}

/**
 * Identify critical beta bifurcation points where effective category count jumps.
 * @param {CodebookState[]} sweep
 * @returns {{beta: number, fromCount: number, toCount: number}[]}
 */
export function detectBifurcations(sweep) {
  const bifurcations = [];
  for (let i = 1; i < sweep.length; i++) {
    if (sweep[i].effectiveClusters > sweep[i - 1].effectiveClusters) {
      bifurcations.push({
        beta: sweep[i].beta,
        fromCount: sweep[i - 1].effectiveClusters,
        toCount: sweep[i].effectiveClusters,
      });
    }
  }
  return bifurcations;
}
