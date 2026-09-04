// @ts-check

/**
 * Every claim this page makes, as data.
 *
 * Each claim carries the sentence it is defending, the failure it is designed to catch, and a
 * `verify()` that re-measures the thing from scratch and either returns the evidence it found or
 * throws with the numbers that contradicted it. No DOM and no `node:test` in here, because both
 * `hysterons.test.js` and the browser panel import this same file. One source of truth, run twice.
 *
 * Thresholds are set from the headless runs in `measure.js`, `measure2.js` and `measure3.js`,
 * always from the worst observed value with headroom, and the observed value is written next to
 * each one.
 */

import {
  createEnsemble, sweepTo, saturateDown, snapshot, mismatch, returnPointExcursion, limitCyclePeriod,
} from './hysterons.js';
import { magnetisation, flowRate } from './observables.js';

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} title      the sentence being defended, in the page's own words
 * @property {string} catches    what a failure here would mean
 * @property {() => string} verify returns the evidence measured, or throws
 */

/** @param {string} message @returns {never} */
function fail(message) {
  throw new Error(message);
}

/** @type {Claim[]} */
export const claims = [
  {
    id: 'uncoupled-return-point-memory',
    title: 'With the switches ignoring each other, a closed excursion returns the system to exactly the state it left.',
    catches: 'The central claim. If a single switch out of sixty came back in the wrong position, return point memory would not be exact and the page would be overselling it.',
    verify() {
      let worst = 0;
      for (let seed = 1; seed <= 40; seed += 1) {
        const ensemble = createEnsemble({ n: 60, seed, kind: 'none' });
        const turningPoint = 0.15 + 0.5 * ((seed % 7) / 7);
        const bottom = -0.35 - 0.4 * ((seed % 5) / 5);
        const { mismatched } = returnPointExcursion(ensemble, turningPoint, bottom, 0.01);
        worst = Math.max(worst, mismatched);
      }
      if (worst !== 0) fail(`${worst} of 60 switches came back in the wrong state`);
      return '40 random ensembles of 60 switches, each taken up to a turning point, down on a random excursion and back: 0 switches out of 60 differed, on every seed.';
    },
  },
  {
    id: 'memory-survives-cooperation',
    title: 'Turning the switches into a strongly cooperating crowd does not destroy the memory, even when single steps set off system-spanning avalanches.',
    catches: 'The intuitive story — "interaction scrambles memory" — is wrong, and this is the test that says so. It fails if any positively coupled ensemble loses its turning point, or if the coupling being tested is too weak to be called strong.',
    verify() {
      let worst = 0;
      let largestAvalanche = 0;
      for (let seed = 1; seed <= 20; seed += 1) {
        const ensemble = createEnsemble({ n: 60, seed, kind: 'ferro', couplingStrength: 0.9 });
        const { mismatched } = returnPointExcursion(ensemble, 0.2 + 0.4 * ((seed % 7) / 7), -0.5, 0.01);
        worst = Math.max(worst, mismatched);

        const sweeper = createEnsemble({ n: 60, seed, kind: 'ferro', couplingStrength: 0.9 });
        saturateDown(sweeper);
        largestAvalanche = Math.max(largestAvalanche, sweepTo(sweeper, 1.4, 0.01).maxAvalanche);
      }
      if (worst !== 0) fail(`positive coupling lost the turning point: ${worst} of 60 switches differed`);
      // Measured: every seed produced a 60-switch avalanche, i.e. the whole ensemble in one step.
      if (largestAvalanche < 30) fail(`coupling of 0.9 was not strong enough to be interesting: largest avalanche only ${largestAvalanche} switches`);
      return `20 ensembles at coupling 0.9 with every interaction positive: 0 of 60 switches differed after the excursion, while the largest single-step avalanche reached ${largestAvalanche} of 60 switches.`;
    },
  },
  {
    id: 'frustration-breaks-memory',
    title: 'Mixed-sign interactions — where switching one element helps some neighbours and hinders others — do break the memory.',
    catches: 'If nothing ever broke return point memory, the page would be describing a property of the model rather than a property with a boundary. This fails if frustrated ensembles never lose their turning point.',
    verify() {
      let failing = 0;
      let worst = 0;
      for (let seed = 1; seed <= 40; seed += 1) {
        const ensemble = createEnsemble({ n: 60, seed, kind: 'frustrated', couplingStrength: 1.4 });
        const { mismatched } = returnPointExcursion(ensemble, 0.15 + 0.5 * ((seed % 7) / 7), -0.35 - 0.4 * ((seed % 5) / 5), 0.01);
        if (mismatched > 0) failing += 1;
        worst = Math.max(worst, mismatched);
      }
      // Measured at coupling 1.4: 10 of 40 seeds failed, worst mismatch 9 switches. Threshold set
      // well below that, because the point is that the failure exists, not that it is common.
      if (failing < 3) fail(`only ${failing} of 40 frustrated ensembles lost their turning point; expected the memory to break`);
      return `At coupling 1.4 with mixed-sign interactions, ${failing} of 40 ensembles failed to return to their turning point, the worst by ${worst} switches out of 60.`;
    },
  },
  {
    id: 'wiping-out',
    title: 'A small excursion is erased the moment a larger one passes over it: two different histories end on one identical state.',
    catches: 'The system is supposed to remember turning points, not everything that ever happened to it. This fails if the erased detour leaves any trace at all.',
    verify() {
      let worst = 0;
      for (let seed = 1; seed <= 30; seed += 1) {
        const withDetour = createEnsemble({ n: 60, seed, kind: 'none' });
        saturateDown(withDetour);
        sweepTo(withDetour, 0.35, 0.01);
        sweepTo(withDetour, -0.2, 0.01);
        sweepTo(withDetour, 0.95, 0.01);
        sweepTo(withDetour, 0, 0.01);

        const without = createEnsemble({ n: 60, seed, kind: 'none' });
        saturateDown(without);
        sweepTo(without, 0.95, 0.01);
        sweepTo(without, 0, 0.01);

        worst = Math.max(worst, mismatch(snapshot(withDetour), snapshot(without)));
      }
      if (worst !== 0) fail(`the wiped-out detour left a trace on ${worst} of 60 switches`);
      return '30 seeds, each driven twice — once with an inner excursion to 0.35 and back, once without — then both taken over the top at 0.95 and down to 0: the two states matched on all 60 switches, every time.';
    },
  },
  {
    id: 'cascades-need-interaction',
    title: 'Avalanches — many switches flipping from one nudge — are a product of interaction, not of the drive being stepped coarsely.',
    catches: 'This one caught a mistake. The first measurement showed avalanches of up to five switches with the interaction switched off, which looked like a cascade and was not: it was two thresholds falling inside one drive step. A real cascade does not shrink when the step shrinks. A coincidence does.',
    verify() {
      /** @param {import('./hysterons.js').CouplingKind} kind @param {number} strength @param {number} increment */
      const meanAvalanche = (kind, strength, increment) => {
        let total = 0;
        let count = 0;
        for (let seed = 1; seed <= 8; seed += 1) {
          const ensemble = createEnsemble({ n: 60, seed, kind, couplingStrength: strength });
          saturateDown(ensemble);
          for (const f of sweepTo(ensemble, 1.4, increment).flips) { total += f; count += 1; }
        }
        return count === 0 ? 0 : total / count;
      };
      const coarseAlone = meanAvalanche('none', 0, 0.02);
      const fineAlone = meanAvalanche('none', 0, 0.0005);
      const fineCoupled = meanAvalanche('ferro', 0.6, 0.0005);
      // Measured over 40 seeds: uncoupled mean fell 1.576 -> 1.006 as the step went 0.02 -> 0.00025,
      // while positively coupled stayed at 12.4. Thresholds carry headroom on both sides.
      if (fineAlone > 1.1) fail(`uncoupled avalanches did not vanish at fine resolution: mean ${fineAlone.toFixed(3)}`);
      if (fineCoupled < 5) fail(`coupled avalanches did not survive at fine resolution: mean ${fineCoupled.toFixed(3)}`);
      return `Uncoupled mean avalanche fell from ${coarseAlone.toFixed(3)} switches at a drive step of 0.02 to ${fineAlone.toFixed(3)} at 0.0005 — it was an artefact of the step. Positively coupled at the same fine step: ${fineCoupled.toFixed(2)} switches.`;
    },
  },
  {
    id: 'subharmonics-need-asymmetry',
    title: 'Repeating exactly the same drive cycle does not always give the same result twice — but only when the influence between switches is one-way.',
    catches: 'Two predictions died here. Symmetric interactions, frustrated or not, never produced anything but a period-1 response in this model. Only when i pushes j without j pushing back does the system need two or three identical cycles to repeat itself. This fails if asymmetry stops producing longer periods, or if symmetry starts.',
    verify() {
      /** @param {import('./hysterons.js').CouplingKind} kind */
      const survey = (kind) => {
        let longer = 0;
        let largest = 1;
        for (let seed = 1; seed <= 200; seed += 1) {
          const ensemble = createEnsemble({ n: 6, seed, kind, couplingStrength: 2.5 });
          const { period } = limitCyclePeriod(ensemble, -0.6, 0.6, 16, 0.01);
          if (period > 1) longer += 1;
          largest = Math.max(largest, period);
        }
        return { longer, largest };
      };
      const asymmetric = survey('asymmetric');
      const symmetric = survey('frustrated');
      // Measured at n=6, coupling 2.5, 200 seeds: asymmetric 20 seeds with period > 1, longest 3;
      // symmetric 0 seeds, longest 1.
      if (asymmetric.longer < 8) fail(`only ${asymmetric.longer} of 200 asymmetric ensembles broke period 1`);
      if (symmetric.longer !== 0) fail(`${symmetric.longer} symmetric ensembles broke period 1, which this model was not supposed to do`);
      return `200 six-switch ensembles at coupling 2.5: with one-way influence, ${asymmetric.longer} needed more than one identical cycle to repeat, the longest taking ${asymmetric.largest} cycles. With mutual influence, ${symmetric.longer} did.`;
    },
  },
  {
    id: 'both-instruments-see-it',
    title: 'The memory is visible from either side of the pairing: the flow meter on the chip and the magnetometer on the iron both come back to the reading they left.',
    catches: 'The two panels are one state vector read through two different instruments, and the flow rate is a product of pressure and conductance rather than a rescaled magnetisation. This fails if the shared state fails to show up identically in two unlike observables.',
    verify() {
      let worstFlow = 0;
      let worstMagnetisation = 0;
      for (let seed = 1; seed <= 20; seed += 1) {
        const ensemble = createEnsemble({ n: 60, seed, kind: 'none' });
        const turningPoint = 0.2 + 0.5 * ((seed % 7) / 7);
        saturateDown(ensemble);
        sweepTo(ensemble, turningPoint, 0.01);
        const flowBefore = flowRate(ensemble.state, ensemble.drive);
        const magnetisationBefore = magnetisation(ensemble.state);
        sweepTo(ensemble, -0.45, 0.01);
        sweepTo(ensemble, turningPoint, 0.01);
        worstFlow = Math.max(worstFlow, Math.abs(flowRate(ensemble.state, ensemble.drive) - flowBefore));
        worstMagnetisation = Math.max(worstMagnetisation, Math.abs(magnetisation(ensemble.state) - magnetisationBefore));
      }
      if (worstFlow > 1e-12 || worstMagnetisation > 1e-12) {
        fail(`readings drifted: flow by ${worstFlow}, magnetisation by ${worstMagnetisation}`);
      }
      return `20 seeds: after the closed excursion the flow rate differed by at most ${worstFlow.toExponential(1)} microlitres per second and the magnetisation by at most ${worstMagnetisation.toExponential(1)}.`;
    },
  },
];

/**
 * Run every claim and collect the outcome. Used by the browser panel; the Node suite runs them one
 * per test so a failure names itself.
 * @returns {{ id: string, title: string, catches: string, passed: boolean, evidence: string }[]}
 */
export function runAllClaims() {
  return claims.map((claim) => {
    try {
      return { id: claim.id, title: claim.title, catches: claim.catches, passed: true, evidence: claim.verify() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id: claim.id, title: claim.title, catches: claim.catches, passed: false, evidence: message };
    }
  });
}
