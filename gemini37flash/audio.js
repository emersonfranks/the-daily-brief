// @ts-check

/**
 * Web Audio Synthesizer for Chiral Resonance and Domain Wall Annihilation Sonification
 */
export class ChiralAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = false;
    /** @type {OscillatorNode | null} */
    this.droneOsc1 = null;
    /** @type {OscillatorNode | null} */
    this.droneOsc2 = null;
    /** @type {GainNode | null} */
    this.masterGain = null;
    /** @type {StereoPannerNode | null} */
    this.panner = null;
  }

  /**
   * Initializes audio context upon user interaction
   */
  async init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      if (this.ctx.createStereoPanner) {
        this.panner = this.ctx.createStereoPanner();
        this.masterGain.connect(this.panner);
        this.panner.connect(this.ctx.destination);
      } else {
        this.masterGain.connect(this.ctx.destination);
      }

      // Continuous ambient drone: Fundamental + Harmonic
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.setValueAtTime(280, this.ctx.currentTime);

      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.droneOsc1.connect(droneGain);
      this.droneOsc2.connect(droneGain);
      droneGain.connect(this.masterGain);

      this.droneOsc1.start();
      this.droneOsc2.start();

      this.enabled = true;
    } catch (e) {
      console.warn('Web Audio initialization prevented or unsupported:', e);
      this.enabled = false;
    }
  }

  /**
   * Toggles audio state
   * @returns {Promise<boolean>}
   */
  async toggle() {
    if (!this.ctx) {
      await this.init();
      return this.enabled;
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
      this.enabled = true;
    } else if (this.ctx.state === 'running') {
      await this.ctx.suspend();
      this.enabled = false;
    }
    return this.enabled;
  }

  /**
   * Updates drone pitches and stereo panning based on enantiomeric excess
   * @param {number} ee Enantiomeric excess [-1, +1]
   */
  update(ee) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Pitch bends higher for right-handed (+), lower for left-handed (-)
    const baseFreq = 150 + ee * 40;
    if (this.droneOsc1) {
      this.droneOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
    }
    if (this.droneOsc2) {
      this.droneOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.1);
    }
    if (this.panner) {
      this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, ee)), now, 0.1);
    }
  }

  /**
   * Plays a crisp, resonant acoustic chime when two perversion kinks annihilate
   * @param {number} pitchMultiplier
   */
  playAnnihilationPop(pitchMultiplier = 1.0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 * pitchMultiplier, now);
      osc.frequency.exponentialRampToValueAtTime(880 * pitchMultiplier, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore audio transient failure
    }
  }
}
