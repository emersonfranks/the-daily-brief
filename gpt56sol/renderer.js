// @ts-check

/** @typedef {import("./cascade-model.js").CascadeResult} CascadeResult */

const palette = {
  fault: { background: "#11100e", line: "#e65f3d", glow: "#ffb06b", text: "#f3ead7" },
  inbox: { background: "#e8e4da", line: "#1f6f78", glow: "#ffcf4a", text: "#17282b" },
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CascadeResult} cascade
 * @param {"fault" | "inbox"} world
 * @param {number} visibleCount
 */
export function drawWorld(canvas, cascade, world, visibleCount) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * pixelRatio));
  const height = Math.max(1, Math.round(bounds.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const displayWidth = width / pixelRatio;
  const displayHeight = height / pixelRatio;
  const colors = palette[world];
  context.fillStyle = colors.background;
  context.fillRect(0, 0, displayWidth, displayHeight);
  drawAtmosphere(context, displayWidth, displayHeight, world);

  const shown = cascade.events.slice(0, visibleCount);
  const byId = new Map(cascade.events.map((event) => [event.id, event]));
  const maxGeneration = Math.max(1, cascade.generationCounts.length - 1);
  const point = (event) => ({
    x: 24 + event.lane * (displayWidth - 48),
    y: 28 + (event.generation / maxGeneration) * (displayHeight - 60),
  });

  context.lineCap = "round";
  for (const event of shown) {
    if (event.parentId === null) continue;
    const parent = byId.get(event.parentId);
    if (!parent) continue;
    const start = point(parent);
    const end = point(event);
    context.strokeStyle = colors.line;
    context.globalAlpha = world === "fault" ? 0.34 + event.strength * 0.4 : 0.3;
    context.lineWidth = world === "fault" ? 0.7 + event.strength * 1.6 : 1;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  for (const event of shown) {
    const position = point(event);
    if (world === "fault") drawAftershock(context, position.x, position.y, event.strength, colors);
    else drawMessage(context, position.x, position.y, event.id, event.strength, colors);
  }
  context.globalAlpha = 1;
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} width
 * @param {number} height
 * @param {"fault" | "inbox"} world
 */
function drawAtmosphere(context, width, height, world) {
  context.save();
  if (world === "fault") {
    context.strokeStyle = "rgba(243,234,215,.055)";
    context.lineWidth = 1;
    for (let line = -height; line < width; line += 22) {
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line + height, height);
      context.stroke();
    }
  } else {
    context.fillStyle = "rgba(31,111,120,.055)";
    for (let row = 22; row < height; row += 26) context.fillRect(0, row, width, 1);
  }
  context.restore();
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} x
 * @param {number} y
 * @param {number} strength
 * @param {{ line: string, glow: string }} colors
 */
function drawAftershock(context, x, y, strength, colors) {
  const radius = 1.7 + strength * 2.6;
  context.save();
  context.shadowColor = colors.glow;
  context.shadowBlur = 11;
  context.fillStyle = colors.glow;
  context.globalAlpha = 0.35 + strength * 0.65;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} x
 * @param {number} y
 * @param {number} id
 * @param {number} strength
 * @param {{ line: string, glow: string }} colors
 */
function drawMessage(context, x, y, id, strength, colors) {
  const width = 8 + strength * 8;
  context.save();
  context.translate(x, y);
  context.fillStyle = id === 0 ? colors.glow : "#fffdf6";
  context.strokeStyle = colors.line;
  context.globalAlpha = 0.72 + strength * 0.28;
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(-width / 2, -3.5, width, 7, 2);
  context.fill();
  context.stroke();
  context.restore();
}