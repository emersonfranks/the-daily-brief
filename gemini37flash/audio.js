// @ts-check

/**
 * @fileoverview Web Audio synthesis engine.
 * Sonifies nonreciprocal momentum, cluster collisions, and broken-symmetry acceleration.
 * Graceful fallback: stays silent until user explicitly enables or clicks audio.
 */

export class AudioEngine {
  constructor() {
    this.enabled = false;
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {OscillatorNode | null} */
    this.droneOsc = null;
    /** @type {GainNode | null} */
    this.droneGain = null;
    /** @type {number} */
    this.lastChirpTime = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Continuous drone mapped to collective center-of-mass momentum
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(110, this.ctx.currentTime); // A2

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.ctx.destination);
      this.droneOsc.start();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.enabled = !this.enabled;
    if (this.droneGain && this.ctx) {
      const targetGain = this.enabled ? 0.08 : 0.0001;
      this.droneGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  /**
   * Update continuous audio state based on simulation metrics.
   * @param {number} netMomentum
   * @param {number} asymmetry
   */
  update(netMomentum, asymmetry) {
    if (!this.enabled || !this.ctx || !this.droneOsc || !this.droneGain) return;

    // Pitch rises with center-of-mass momentum & nonreciprocity
    const baseFreq = 110 + asymmetry * 80 + netMomentum * 40;
    this.droneOsc.frequency.setTargetAtTime(Math.min(600, baseFreq), this.ctx.currentTime, 0.1);
  }

  /**
   * Trigger acoustic ping when a chasing pair forms or cluster fission occurs.
   * @param {number} freq
   */
  playEvent(freq = 440) {
    if (!this.enabled || !this.ctx) return;
    const now = Date.now();
    if (now - this.lastChirpTime < 80) return; // Throttle events
    this.lastChirpTime = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch (_) {}
  }
}
