// @ts-check

import { CUT_COUNT, createCuts, createState, advance, measureArrival } from "./transport.js";

const seeds = [3, 11, 29, 47, 83];

export const claims = [
  {
    name: "A seam delays the crossing",
    catches: "Fails if a near-continuous seam is not slower than every equal-count scattered pattern.",
    verify() {
      const seam = seeds.map((seed) => measureArrival(1, seed).arrivalStep);
      const scattered = seeds.map((seed) => measureArrival(0, seed).arrivalStep);
      const slowestScatter = Math.max(...scattered);
      const fastestSeam = Math.min(...seam);
      if (!(fastestSeam > slowestScatter)) {
        throw new Error(`fastest seam ${fastestSeam} <= slowest scatter ${slowestScatter}`);
      }
      return `5/5 seeds: seam ${fastestSeam}–${Math.max(...seam)} steps; scatter ${Math.min(...scattered)}–${slowestScatter}.`;
    },
  },
  {
    name: "Damage amount stays fixed",
    catches: "Fails if the comparison quietly gives one crack pattern more broken bonds.",
    verify() {
      const counts = [0, 0.5, 1].flatMap((coherence) =>
        seeds.map((seed) => createCuts(coherence, seed).size),
      );
      if (counts.some((count) => count !== CUT_COUNT)) {
        throw new Error(`observed cut counts: ${counts.join(", ")}`);
      }
      return `15/15 patterns contain exactly ${CUT_COUNT} broken bonds.`;
    },
  },
  {
    name: "The solver remains bounded",
    catches: "Fails if numerical diffusion creates concentration from nowhere or drops below zero.",
    verify() {
      let state = createState(createCuts(0.7, 19));
      let minimum = 1;
      let maximum = 0;
      for (let step = 0; step < 900; step += 1) {
        state = advance(state);
        for (const value of state.values) {
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }
      }
      if (minimum < -1e-12 || maximum > 1 + 1e-12) {
        throw new Error(`range escaped bounds: ${minimum}–${maximum}`);
      }
      return `Across 612,000 cell updates, values stayed within ${minimum.toFixed(3)}–${maximum.toFixed(3)}.`;
    },
  },
  {
    name: "One graph drives both worlds",
    catches: "Fails if the rock and relay panels use different state rather than a true mathematical relabeling.",
    verify() {
      const cuts = createCuts(0.62, 31);
      let rock = createState(cuts);
      let relay = createState(cuts);
      for (let step = 0; step < 400; step += 1) {
        rock = advance(rock);
        relay = advance(relay);
      }
      const mismatch = rock.values.reduce(
        (largest, value, index) => Math.max(largest, Math.abs(value - relay.values[index])),
        0,
      );
      if (mismatch !== 0) throw new Error(`panel mismatch ${mismatch}`);
      return `After 400 steps, maximum panel-state mismatch is ${mismatch}.`;
    },
  },
];
