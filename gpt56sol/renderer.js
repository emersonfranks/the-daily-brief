// @ts-check

const TAU = Math.PI * 2;

function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: canvas.clientWidth, height: canvas.clientHeight };
}

function pulse(phase) {
  const wrapped = Math.abs(Math.atan2(Math.sin(phase), Math.cos(phase)));
  return Math.exp(-wrapped * wrapped * 8);
}

export function drawFireflies(canvas, oscillators) {
  const { context, width, height } = fitCanvas(canvas);
  context.clearRect(0, 0, width, height);
  const fieldTop = 82;
  const fieldHeight = height - 120;

  context.strokeStyle = "rgba(110, 231, 222, 0.08)";
  for (let index = 0; index < 5; index += 1) {
    const y = fieldTop + (fieldHeight * index) / 4;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y + 16);
    context.stroke();
  }

  oscillators.forEach((oscillator, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const x = width * (0.1 + column * 0.16) + Math.sin(oscillator.angle) * 12;
    const y = fieldTop + fieldHeight * (0.08 + row * 0.17) + Math.cos(oscillator.angle * 1.7) * 12;
    const intensity = pulse(oscillator.phase);
    const glow = context.createRadialGradient(x, y, 0, x, y, 8 + intensity * 30);
    glow.addColorStop(0, `rgba(215,255,99,${0.35 + intensity * 0.65})`);
    glow.addColorStop(0.25, `rgba(215,255,99,${intensity * 0.35})`);
    glow.addColorStop(1, "rgba(215,255,99,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 8 + intensity * 30, 0, TAU);
    context.fill();
    context.fillStyle = intensity > 0.35 ? "#efffa6" : "#53684e";
    context.beginPath();
    context.arc(x, y, 2.2 + intensity * 2.5, 0, TAU);
    context.fill();
  });
}

export function drawGrid(canvas, oscillators) {
  const { context, width, height } = fitCanvas(canvas);
  context.clearRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2 + 18;
  const maxRadius = Math.min(width, height) * 0.38;

  context.strokeStyle = "rgba(110,231,222,0.12)";
  context.lineWidth = 1;
  oscillators.forEach((oscillator) => {
    const x = centerX + Math.cos(oscillator.angle) * maxRadius * oscillator.radius;
    const y = centerY + Math.sin(oscillator.angle) * maxRadius * oscillator.radius;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(x, y);
    context.stroke();
  });

  context.fillStyle = "#d7ff63";
  context.beginPath();
  context.arc(centerX, centerY, 5, 0, TAU);
  context.fill();

  oscillators.forEach((oscillator) => {
    const x = centerX + Math.cos(oscillator.angle) * maxRadius * oscillator.radius;
    const y = centerY + Math.sin(oscillator.angle) * maxRadius * oscillator.radius;
    const needleX = x + Math.cos(oscillator.phase) * 11;
    const needleY = y + Math.sin(oscillator.phase) * 11;
    context.fillStyle = "#10221d";
    context.strokeStyle = "#6ee7de";
    context.beginPath();
    context.arc(x, y, 14, 0, TAU);
    context.fill();
    context.stroke();
    context.strokeStyle = "#ffb84d";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(needleX, needleY);
    context.stroke();
    context.fillStyle = "#f3f0e4";
    context.beginPath();
    context.arc(x, y, 2.2, 0, TAU);
    context.fill();
  });
}