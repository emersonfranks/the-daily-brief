// @ts-check

/**
 * Painting only. The renderer reads a GrainModel and never advances it, which is why the
 * same lattice can be drawn as foam and as metal in the same frame.
 */

/** @typedef {import('./grain-model.js').GrainModel} GrainModel */
/** @typedef {{ divide: number, fateMode: boolean, tracked: number }} ViewOptions */

/**
 * Writes one HSL colour into an RGBA buffer.
 * @param {number} hue degrees
 * @param {number} saturation 0..1
 * @param {number} lightness 0..1
 * @param {Uint8ClampedArray} out
 * @param {number} offset
 */
function writeHsl(hue, saturation, lightness, out, offset) {
  const h = hue / 360;
  const s = Math.min(Math.max(saturation, 0), 1);
  const l = Math.min(Math.max(lightness, 0), 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    const shifted = (t + 1) % 1;
    if (shifted < 1 / 6) return p + (q - p) * 6 * shifted;
    if (shifted < 1 / 2) return q;
    if (shifted < 2 / 3) return p + (q - p) * (2 / 3 - shifted) * 6;
    return p;
  };
  out[offset] = channel(h + 1 / 3) * 255;
  out[offset + 1] = channel(h) * 255;
  out[offset + 2] = channel(h - 1 / 3) * 255;
  out[offset + 3] = 255;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {GrainModel} model
 */
export function createRenderer(canvas, model) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2d canvas context unavailable');

  const size = model.size;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const offscreenContext = offscreen.getContext('2d');
  if (!offscreenContext) throw new Error('offscreen 2d context unavailable');

  const image = offscreenContext.createImageData(size, size);
  const pixels = image.data;
  const wall = new Uint8Array(model.siteCount);
  const tint = new Float32Array(model.seedCount);
  const shade = new Float32Array(model.seedCount);
  for (let cell = 0; cell < model.seedCount; cell++) {
    tint[cell] = (Math.sin(cell * 12.9898) * 43758.5453) % 1;
    shade[cell] = (Math.sin(cell * 78.233) * 24634.6345) % 1;
    if (tint[cell] < 0) tint[cell] += 1;
    if (shade[cell] < 0) shade[cell] += 1;
  }

  function markWalls() {
    const { state } = model;
    for (let y = 0; y < size; y++) {
      const row = y * size;
      const below = ((y + 1) % size) * size;
      const above = ((y + size - 1) % size) * size;
      for (let x = 0; x < size; x++) {
        const owner = state[row + x];
        wall[row + x] = (
          state[row + ((x + 1) % size)] !== owner ||
          state[row + ((x + size - 1) % size)] !== owner ||
          state[below + x] !== owner ||
          state[above + x] !== owner
        ) ? 1 : 0;
      }
    }
  }

  /** @param {ViewOptions} options */
  function draw({ divide, fateMode, tracked }) {
    markWalls();
    const { state, sides } = model;
    const cut = Math.floor(divide * size);

    for (let y = 0; y < size; y++) {
      const row = y * size;
      const below = ((y + 1) % size) * size;
      const above = ((y + size - 1) % size) * size;
      for (let x = 0; x < size; x++) {
        const site = row + x;
        const cell = state[site];
        const offset = site * 4;
        const isWall = wall[site] === 1;
        const nearWall = !isWall && (
          wall[row + ((x + 1) % size)] |
          wall[row + ((x + size - 1) % size)] |
          wall[below + x] |
          wall[above + x]
        ) === 1;
        const foamSide = x < cut;
        const selected = cell === tracked;

        if (fateMode) {
          const delta = sides[cell] - 6;
          const magnitude = Math.min(1, Math.abs(delta) / 3);
          const hue = delta < 0 ? 208 : 24;
          const saturation = delta === 0 ? 0 : 0.2 + 0.65 * magnitude;
          let lightness = delta === 0 ? 0.3 : 0.2 + 0.3 * magnitude;
          if (foamSide) lightness *= 1.12;
          if (isWall) writeHsl(hue, saturation * 0.3, foamSide ? 0.92 : 0.06, pixels, offset);
          else if (selected) writeHsl(hue, saturation, Math.min(0.8, lightness + 0.25), pixels, offset);
          else writeHsl(hue, saturation, nearWall ? lightness * 1.3 : lightness, pixels, offset);
        } else if (foamSide) {
          if (isWall) writeHsl(44, 0.3, 0.9, pixels, offset);
          else if (nearWall) writeHsl(40, 0.55, 0.26 + shade[cell] * 0.07, pixels, offset);
          else writeHsl(38 + tint[cell] * 14, 0.58, selected ? 0.34 : 0.055 + shade[cell] * 0.05, pixels, offset);
        } else {
          const lightness = 0.22 + shade[cell] * 0.4;
          if (isWall) writeHsl(213, 0.16, 0.045, pixels, offset);
          else if (nearWall) writeHsl(213, 0.1, lightness * 0.72, pixels, offset);
          else writeHsl(207 + tint[cell] * 12, 0.09, selected ? Math.min(0.88, lightness + 0.26) : lightness, pixels, offset);
        }
      }
    }

    offscreenContext.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @returns {number} the cell under the pointer, or -1
   */
  function cellAt(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor((clientX - bounds.left) / bounds.width * size);
    const y = Math.floor((clientY - bounds.top) / bounds.height * size);
    if (x < 0 || y < 0 || x >= size || y >= size) return -1;
    return model.state[y * size + x];
  }

  return { draw, resize, cellAt };
}
