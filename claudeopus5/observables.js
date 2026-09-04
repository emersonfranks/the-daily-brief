// @ts-check

/**
 * Two sets of units bolted onto one state vector.
 *
 * The point of the page is that the same ensemble of switches is being read out twice. Here is
 * where that is made concrete, and where the honest caveat lives: nothing in this file is
 * measured from a real chip or a real magnet. These are the standard textbook readouts of each
 * system, applied to a shared model. The claim the page makes is that the *model* is shared,
 * which is a mathematical statement, supported empirically by the fact that both substrates have
 * been observed obeying it.
 *
 * @typedef {import('./hysterons.js').Ensemble} Ensemble
 */

/** Drive is dimensionless in [-1.4, 1.4]; these map it onto each system's control knob. */
export const DRIVE_MIN = -1.4;
export const DRIVE_MAX = 1.4;

/** Hydraulic conductance of one channel with its fibre straight, in arbitrary units. */
export const CONDUCTANCE_OPEN = 1;
/** Conductance of the same channel once the fibre has buckled across it. Model parameter, not a measurement. */
export const CONDUCTANCE_BUCKLED = 0.28;

/**
 * Applied pressure drop across the chip, in kPa, as a linear function of the drive.
 * @param {number} drive
 * @returns {number}
 */
export function pressureFromDrive(drive) {
  return 12 * (drive - DRIVE_MIN) / (DRIVE_MAX - DRIVE_MIN);
}

/**
 * Applied magnetic field, in mT, as a linear function of the same drive.
 * @param {number} drive
 * @returns {number}
 */
export function fieldFromDrive(drive) {
  return 40 * drive;
}

/**
 * Magnetisation: the mean of the switch states, in [-1, 1]. In the magnet a hysteron that is ON is
 * a domain pointing along the field.
 * @param {Uint8Array} state
 * @returns {number}
 */
export function magnetisation(state) {
  if (state.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < state.length; i += 1) sum += state[i] === 1 ? 1 : -1;
  return sum / state.length;
}

/**
 * Mean hydraulic conductance of the chip. In the fluid a hysteron that is ON is a fibre that has
 * buckled across its channel, throttling it.
 * @param {Uint8Array} state
 * @returns {number}
 */
export function conductance(state) {
  if (state.length === 0) return CONDUCTANCE_OPEN;
  let sum = 0;
  for (let i = 0; i < state.length; i += 1) {
    sum += state[i] === 1 ? CONDUCTANCE_BUCKLED : CONDUCTANCE_OPEN;
  }
  return sum / state.length;
}

/**
 * Volumetric flow rate through the chip, in microlitres per second: pressure times conductance.
 * Deliberately *not* an affine image of the magnetisation — the two panels show genuinely
 * different-looking curves produced by one hidden state, which is why matching their memory
 * structure means something.
 * @param {Uint8Array} state
 * @param {number} drive
 * @returns {number}
 */
export function flowRate(state, drive) {
  return pressureFromDrive(drive) * conductance(state);
}

/**
 * Both readouts at once, for a renderer or a claim that wants to compare them.
 * @param {Ensemble} ensemble
 * @returns {{ pressure: number, field: number, flow: number, magnetisation: number, conductance: number }}
 */
export function readouts(ensemble) {
  return {
    pressure: pressureFromDrive(ensemble.drive),
    field: fieldFromDrive(ensemble.drive),
    flow: flowRate(ensemble.state, ensemble.drive),
    magnetisation: magnetisation(ensemble.state),
    conductance: conductance(ensemble.state),
  };
}
