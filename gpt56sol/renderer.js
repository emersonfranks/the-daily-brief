// @ts-check

import { COLS, ROWS } from "./transport.js";

/**
 * @param {HTMLCanvasElement} canvas
 * @param {"rock" | "relay"} world
 */
export function createRenderer(canvas, world) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = 680;
  const height = 400;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);

  /**
   * @param {Float64Array} values
   * @param {Set<string>} cuts
   */
  return (values, cuts) => {
    context.clearRect(0, 0, width, height);
    const cellW = width / COLS;
    const cellH = height / ROWS;
    const key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

    if (world === "rock") {
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          const value = values[y * COLS + x];
          const hue = 226 - value * 208;
          const light = 13 + value * 52;
          context.fillStyle = `hsl(${hue} 88% ${light}%)`;
          context.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
      context.strokeStyle = "rgba(5, 8, 13, .95)";
      context.lineWidth = 3;
      for (const cut of cuts) {
        const [a, b] = cut.split(":").map(Number);
        const ax = a % COLS;
        const ay = Math.floor(a / COLS);
        const bx = b % COLS;
        const by = Math.floor(b / COLS);
        context.beginPath();
        if (ay === by) {
          const x = Math.max(ax, bx) * cellW;
          context.moveTo(x, ay * cellH);
          context.lineTo(x, (ay + 1) * cellH);
        } else {
          const y = Math.max(ay, by) * cellH;
          context.moveTo(ax * cellW, y);
          context.lineTo((ax + 1) * cellW, y);
        }
        context.stroke();
      }
    } else {
      context.fillStyle = "#07131b";
      context.fillRect(0, 0, width, height);
      context.lineWidth = 0.65;
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          const index = y * COLS + x;
          context.strokeStyle = "rgba(109, 143, 151, .25)";
          if (x < COLS - 1 && !cuts.has(key(index, index + 1))) {
            context.beginPath();
            context.moveTo((x + 0.5) * cellW, (y + 0.5) * cellH);
            context.lineTo((x + 1.5) * cellW, (y + 0.5) * cellH);
            context.stroke();
          }
          if (y < ROWS - 1 && !cuts.has(key(index, index + COLS))) {
            context.beginPath();
            context.moveTo((x + 0.5) * cellW, (y + 0.5) * cellH);
            context.lineTo((x + 0.5) * cellW, (y + 1.5) * cellH);
            context.stroke();
          }
          const value = values[index];
          context.fillStyle = `hsl(${174 - value * 125} 92% ${23 + value * 55}%)`;
          context.beginPath();
          context.arc((x + 0.5) * cellW, (y + 0.5) * cellH, 1.7 + value * 3.4, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  };
}
