// @ts-check

const INK = "#17201d";
const PAPER = "#f2efe6";
const CORAL = "#ef5b40";
const TEAL = "#087f78";

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable.");
  }

  /** @param {number} width @param {number} height */
  function size(width, height) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** @param {number} x @param {number} y @param {number} width @param {number} height @param {number} radius */
  function roundedRect(x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  /** @param {number} centerX @param {number} centerY @param {number} scale */
  function drawNose(centerX, centerY, scale) {
    context.save();
    context.translate(centerX, centerY);
    context.scale(scale, scale);
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-35, -66);
    context.bezierCurveTo(-18, -60, -18, -20, -5, -3);
    context.bezierCurveTo(8, 14, 25, 20, 21, 31);
    context.bezierCurveTo(17, 42, -7, 41, -18, 33);
    context.stroke();
    context.beginPath();
    context.arc(-7, 29, 3, 0, Math.PI * 2);
    context.fillStyle = CORAL;
    context.fill();
    context.restore();
  }

  /** @param {number} centerX @param {number} centerY @param {number} scale @param {number} phase */
  function drawBacterium(centerX, centerY, scale, phase) {
    context.save();
    context.translate(centerX, centerY);
    context.rotate(-0.16 + Math.sin(phase) * 0.035);
    context.scale(scale, scale);
    context.fillStyle = "#d5e3c4";
    context.strokeStyle = INK;
    context.lineWidth = 2.5;
    roundedRect(-55, -26, 110, 52, 26);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(53, 2);
    context.bezierCurveTo(90, -28, 98, 38, 132, 11);
    context.stroke();
    for (let index = 0; index < 7; index += 1) {
      const x = -37 + (index % 4) * 24;
      const y = -11 + Math.floor(index / 4) * 22;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fillStyle = index % 2 ? TEAL : CORAL;
      context.fill();
    }
    context.restore();
  }

  /** @param {number} startX @param {number} endX @param {number} top @param {number} bottom @param {number} count @param {number} phase @param {string} color */
  function drawParticles(startX, endX, top, bottom, count, phase, color) {
    context.fillStyle = color;
    for (let index = 0; index < count; index += 1) {
      const horizontal = (Math.sin(index * 91.73 + 2.1) + 1) / 2;
      const vertical = (Math.sin(index * 47.11 + 0.8) + 1) / 2;
      const drift = Math.sin(phase * (0.55 + (index % 5) * 0.06) + index) * 7;
      context.globalAlpha = 0.24 + (index % 4) * 0.16;
      context.beginPath();
      context.arc(startX + horizontal * (endX - startX) + drift, top + vertical * (bottom - top), 2 + (index % 3), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /** @param {number[]} history @param {number} x @param {number} y @param {number} width @param {number} height */
  function drawTrace(history, x, y, width, height) {
    context.strokeStyle = "rgba(23, 32, 29, 0.18)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y + height / 2);
    context.lineTo(x + width, y + height / 2);
    context.stroke();
    context.strokeStyle = CORAL;
    context.lineWidth = 2.5;
    context.beginPath();
    history.forEach((value, index) => {
      const pointX = x + (index / Math.max(history.length - 1, 1)) * width;
      const pointY = y + height / 2 - Math.max(-1.5, Math.min(1.5, value)) / 3 * height;
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    });
    context.stroke();
  }

  /** @param {{ signal: number, response: number, memory: number, history: number[], phase: number }} frame */
  function render(frame) {
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    if (canvas.width === 0 || Math.abs(canvas.width / Math.min(window.devicePixelRatio || 1, 2) - width) > 1) {
      size(width, height);
    }
    context.clearRect(0, 0, width, height);
    context.fillStyle = PAPER;
    context.fillRect(0, 0, width, height);
    const gap = width < 720 ? 10 : 18;
    const panelWidth = (width - gap) / 2;
    const flare = Math.min(Math.abs(frame.response) / 1.4, 1);
    const count = Math.round(14 + Math.sqrt(frame.signal) * 12);

    context.fillStyle = `rgba(239, 91, 64, ${0.035 + flare * 0.13})`;
    context.fillRect(0, 0, panelWidth, height);
    context.fillStyle = `rgba(8, 127, 120, ${0.035 + flare * 0.13})`;
    context.fillRect(panelWidth + gap, 0, panelWidth, height);
    context.fillStyle = INK;
    context.font = "600 12px 'Aptos Narrow', sans-serif";
    context.fillText("OLFACTORY ADAPTATION", 18, 29);
    context.fillText("BACTERIAL CHEMOTAXIS", panelWidth + gap + 18, 29);

    drawParticles(12, panelWidth - 12, 42, height - 86, count, frame.phase, CORAL);
    drawParticles(panelWidth + gap + 12, width - 12, 42, height - 86, count, frame.phase, TEAL);
    const scale = width < 600 ? 0.72 : 1;
    drawNose(panelWidth / 2, height * 0.47, scale);
    drawBacterium(panelWidth + gap + panelWidth / 2, height * 0.47, scale, frame.phase);

    const flareX = panelWidth + gap / 2;
    const gradient = context.createLinearGradient(0, height * 0.2, 0, height * 0.8);
    gradient.addColorStop(0, "rgba(239, 91, 64, 0)");
    gradient.addColorStop(0.5, `rgba(239, 91, 64, ${0.2 + flare * 0.8})`);
    gradient.addColorStop(1, "rgba(239, 91, 64, 0)");
    context.fillStyle = gradient;
    context.fillRect(flareX - 2 - flare * 7, height * 0.17, 4 + flare * 14, height * 0.66);

    drawTrace(frame.history, 18, height - 67, panelWidth - 36, 48);
    drawTrace(frame.history, panelWidth + gap + 18, height - 67, panelWidth - 36, 48);
    context.fillStyle = INK;
    context.globalAlpha = 0.58;
    context.font = "11px 'Aptos', sans-serif";
    context.fillText(`memory ${frame.memory.toFixed(2)}×`, 18, height - 76);
    context.fillText(`memory ${frame.memory.toFixed(2)}×`, panelWidth + gap + 18, height - 76);
    context.globalAlpha = 1;
  }

  return { render };
}
