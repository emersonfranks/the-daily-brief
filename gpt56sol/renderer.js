// @ts-check

/** @typedef {import("./synchrony-model.js").OscillatorState} OscillatorState */

const TAU = Math.PI * 2;

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  /** @param {OscillatorState} state */
  return function render(state) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelWidth = Math.floor(width * ratio);
    const pixelHeight = Math.floor(height * ratio);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#07191d";
    context.fillRect(0, 0, width, height);

    const vertical = width < 700;
    const split = vertical ? height / 2 : width / 2;
    drawField(context, state, vertical ? width : split, vertical ? split : height, 0, 0);
    drawGrid(context, state, vertical ? width : split, vertical ? height - split : height, vertical ? 0 : split, vertical ? split : 0);

    context.strokeStyle = "rgba(238,242,232,.2)";
    context.beginPath();
    if (vertical) {
      context.moveTo(0, split);
      context.lineTo(width, split);
    } else {
      context.moveTo(split, 0);
      context.lineTo(split, height);
    }
    context.stroke();
  };
}

/** @param {CanvasRenderingContext2D} context @param {OscillatorState} state @param {number} width @param {number} height @param {number} offsetX @param {number} offsetY */
function drawField(context, state, width, height, offsetX, offsetY) {
  const columns = 8;
  for (let index = 0; index < state.phases.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = offsetX + width * (.09 + column / (columns - 1) * .82);
    const y = offsetY + height * (.19 + row / 5 * .65) + Math.sin(index * 4.7) * 8;
    const flash = Math.pow(Math.max(0, Math.cos(state.phases[index])), 12);
    const radius = 2.5 + flash * 6;
    context.fillStyle = `rgba(255,216,90,${.18 + flash * .82})`;
    context.shadowColor = "#ffd85a";
    context.shadowBlur = flash * 28;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }
  context.shadowBlur = 0;
}

/** @param {CanvasRenderingContext2D} context @param {OscillatorState} state @param {number} width @param {number} height @param {number} offsetX @param {number} offsetY */
function drawGrid(context, state, width, height, offsetX, offsetY) {
  const columns = 8;
  const radius = Math.min(width / 22, height / 17, 15);
  for (let index = 0; index < state.phases.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = offsetX + width * (.09 + column / (columns - 1) * .82);
    const y = offsetY + height * (.19 + row / 5 * .65);
    const phase = state.phases[index];
    context.strokeStyle = "rgba(170,197,193,.38)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.stroke();
    context.strokeStyle = "#b9f54a";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(phase) * radius, y + Math.sin(phase) * radius);
    context.stroke();
    context.fillStyle = "#ff6b52";
    context.beginPath();
    context.arc(x, y, 2, 0, TAU);
    context.fill();
  }
}