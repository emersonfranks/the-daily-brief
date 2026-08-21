// @ts-check

import { runSweep } from "./cascade-model.js";

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
function contextFor(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  return context;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ context: CanvasRenderingContext2D, width: number, height: number }}
 */
function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(bounds.width * ratio));
  canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  const context = contextFor(canvas);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: bounds.width, height: bounds.height };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} state
 * @param {number[]} resistance
 * @param {number} size
 */
export function drawMagnet(canvas, state, resistance, size) {
  const { context, width, height } = fitCanvas(canvas);
  const cellWidth = width / size;
  const cellHeight = height / size;
  context.fillStyle = "#e4dcc9";
  context.fillRect(0, 0, width, height);
  for (let index = 0; index < state.length; index += 1) {
    const row = Math.floor(index / size);
    const column = index % size;
    const x = column * cellWidth;
    const y = row * cellHeight;
    const inset = Math.max(0.7, cellWidth * 0.1);
    context.fillStyle = state[index] === 1 ? "#0c55b8" : "#d33b2f";
    context.globalAlpha = 0.72 + Math.abs(resistance[index]) * 0.28;
    context.fillRect(x + inset, y + inset, cellWidth - inset * 2, cellHeight - inset * 2);
    context.globalAlpha = 1;
    context.strokeStyle = "rgba(240,234,219,0.86)";
    context.lineWidth = Math.max(0.6, cellWidth * 0.08);
    context.beginPath();
    context.moveTo(x + cellWidth * 0.25, y + (state[index] === 1 ? cellHeight * 0.72 : cellHeight * 0.28));
    context.lineTo(x + cellWidth * 0.75, y + (state[index] === 1 ? cellHeight * 0.28 : cellHeight * 0.72));
    context.stroke();
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} state
 * @param {number[]} resistance
 * @param {number} size
 */
export function drawBank(canvas, state, resistance, size) {
  const { context, width, height } = fitCanvas(canvas);
  const cellWidth = width / size;
  const cellHeight = height / size;
  context.fillStyle = "#e4dcc9";
  context.fillRect(0, 0, width, height);
  for (let index = 0; index < state.length; index += 1) {
    const row = Math.floor(index / size);
    const column = index % size;
    const x = column * cellWidth;
    const y = row * cellHeight;
    const gap = Math.max(0.55, cellWidth * 0.08);
    context.fillStyle = "rgba(23,23,20,0.12)";
    context.fillRect(x + gap, y + gap, cellWidth - gap * 2, cellHeight - gap * 2);
    context.fillStyle = state[index] === 1 ? "#0c55b8" : "#d33b2f";
    context.globalAlpha = 0.68 + Math.abs(resistance[index]) * 0.3;
    if (state[index] === 1) {
      context.fillRect(x + cellWidth * 0.24, y + cellHeight * 0.22, cellWidth * 0.52, cellHeight * 0.58);
    } else {
      context.fillRect(x + cellWidth * 0.16, y + cellHeight * 0.44, cellWidth * 0.68, cellHeight * 0.18);
    }
    context.globalAlpha = 1;
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function drawTrace(canvas) {
  const { context, width, height } = fitCanvas(canvas);
  const data = runSweep(47);
  const margin = { left: 42, right: 20, top: 22, bottom: 36 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(23,23,20,0.25)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(margin.left, margin.top);
  context.lineTo(margin.left, margin.top + plotHeight);
  context.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  context.stroke();
  context.font = "10px Cascadia Mono, monospace";
  context.fillStyle = "#706c62";
  context.fillText("100% UP / STAY", 0, margin.top + 4);
  context.fillText("0%", 17, margin.top + plotHeight);
  context.fillText("PANIC / DOWN", margin.left, height - 8);
  context.textAlign = "right";
  context.fillText("ASSURED / UP", width - margin.right, height - 8);
  context.textAlign = "left";
  const drawPath = (/** @type {"descending" | "ascending"} */ key, color) => {
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    data.forEach((point, index) => {
      const x = margin.left + ((point.pressure + 1.6) / 3.2) * plotWidth;
      const y = margin.top + (1 - point[key]) * plotHeight;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  };
  drawPath("descending", "#d33b2f");
  drawPath("ascending", "#0c55b8");
  context.font = "700 10px Cascadia Mono, monospace";
  context.fillStyle = "#d33b2f";
  context.fillText("FIELD FALLING", margin.left + plotWidth * 0.54, margin.top + 15);
  context.fillStyle = "#0c55b8";
  context.fillText("FIELD RISING", margin.left + plotWidth * 0.1, margin.top + plotHeight - 12);
}