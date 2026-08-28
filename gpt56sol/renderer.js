// @ts-check

/** @typedef {import("./assembly.js").PatternAnalysis} PatternAnalysis */

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  let current = /** @type {PatternAnalysis | null} */ (null);
  let reveal = 1;
  let animationFrame = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * scale);
    canvas.height = Math.round(bounds.height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (current) draw(current, reveal, bounds.width, bounds.height);
  }

  /** @param {PatternAnalysis} analysis @param {boolean} animate */
  function render(analysis, animate = true) {
    current = analysis;
    cancelAnimationFrame(animationFrame);
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal = 1;
      resize();
      return;
    }
    const started = performance.now();
    const tick = (now) => {
      reveal = Math.min(1, (now - started) / 650);
      resize();
      if (reveal < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
  }

  /** @param {PatternAnalysis} analysis @param {number} progress @param {number} width @param {number} height */
  function draw(analysis, progress, width, height) {
    context.clearRect(0, 0, width, height);
    const split = width / 2;
    drawWorkshop(context, analysis, progress, 0, split, height);
    drawSignal(context, analysis, progress, split, split, height);
  }

  window.addEventListener("resize", resize);
  resize();
  return { render, resize };
}

/** @param {CanvasRenderingContext2D} context @param {PatternAnalysis} analysis @param {number} progress @param {number} left @param {number} width @param {number} height */
function drawWorkshop(context, analysis, progress, left, width, height) {
  context.save();
  context.beginPath();
  context.rect(left, 0, width, height);
  context.clip();
  const visibleSteps = Math.ceil(analysis.steps.length * progress);
  const centerX = left + width / 2;
  const top = 62;
  const rowGap = Math.min(70, (height - 120) / Math.max(analysis.steps.length, 1));
  context.textAlign = "center";
  context.font = "600 12px 'IBM Plex Mono', monospace";
  for (let index = 0; index < visibleSteps; index += 1) {
    const step = analysis.steps[index];
    const y = top + index * rowGap;
    const alpha = Math.min(1, progress * analysis.steps.length - index + 0.15);
    context.globalAlpha = alpha;
    drawPiece(context, step.left, centerX - 72, y, "#ef8354");
    drawPiece(context, step.right, centerX + 72, y, "#ef8354");
    context.strokeStyle = "rgba(239, 131, 84, .45)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(centerX - 52, y + 19);
    context.lineTo(centerX, y + 36);
    context.lineTo(centerX + 52, y + 19);
    context.stroke();
    drawPiece(context, step.result, centerX, y + 42, index === analysis.steps.length - 1 ? "#f6c85f" : "#ef8354");
  }
  context.restore();
}

/** @param {CanvasRenderingContext2D} context @param {string} value @param {number} x @param {number} y @param {string} color */
function drawPiece(context, value, x, y, color) {
  const boxWidth = Math.max(36, value.length * 11 + 18);
  context.fillStyle = "#111820";
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(x - boxWidth / 2, y, boxWidth, 30, 3);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.fillText(value, x, y + 20);
}

/** @param {CanvasRenderingContext2D} context @param {PatternAnalysis} analysis @param {number} progress @param {number} left @param {number} width @param {number} height */
function drawSignal(context, analysis, progress, left, width, height) {
  context.save();
  context.beginPath();
  context.rect(left, 0, width, height);
  context.clip();
  const centerX = left + width / 2;
  const baseY = height * 0.55;
  const samples = 42;
  context.strokeStyle = "rgba(94, 196, 183, .2)";
  context.lineWidth = 1;
  for (let index = 0; index < samples; index += 1) {
    const x = left + 28 + index * ((width - 56) / (samples - 1));
    context.beginPath();
    context.moveTo(x, baseY - 34);
    context.lineTo(x, baseY + 34);
    context.stroke();
  }
  const pulseCount = Math.floor(samples * progress);
  for (let index = 0; index < pulseCount; index += 1) {
    const bit = analysis.pattern[index % analysis.pattern.length];
    const x = left + 28 + index * ((width - 56) / (samples - 1));
    context.fillStyle = bit === "1" ? "#5ec4b7" : "#2b6f75";
    context.beginPath();
    context.arc(x, baseY + (bit === "1" ? -19 : 19), 4, 0, Math.PI * 2);
    context.fill();
  }
  context.textAlign = "center";
  context.fillStyle = "#d9f4ef";
  context.font = "700 26px 'IBM Plex Mono', monospace";
  context.fillText(`${analysis.waitingTime}`, centerX, 82);
  context.fillStyle = "rgba(217, 244, 239, .65)";
  context.font = "500 11px 'IBM Plex Mono', monospace";
  context.fillText("EXPECTED FLIPS", centerX, 102);
  if (analysis.overlapTax > 0) {
    context.fillStyle = "#f6c85f";
    context.font = "600 13px 'IBM Plex Mono', monospace";
    context.fillText(`+${analysis.overlapTax} from self-overlap`, centerX, height - 42);
  } else {
    context.fillStyle = "#5ec4b7";
    context.font = "600 13px 'IBM Plex Mono', monospace";
    context.fillText("no overlap penalty", centerX, height - 42);
  }
  context.restore();
}
