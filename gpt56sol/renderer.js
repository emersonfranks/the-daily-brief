// @ts-check

const colors = {
  night: "#071c24",
  cream: "#f4edda",
  coral: "#ff6b4a",
  cyan: "#40d9cf",
  gold: "#f3c84b",
  dim: "#59717a",
};

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable");

  /** @param {number[]} phases @param {number} coherence @param {boolean} shocked */
  function render(phases, coherence, shocked) {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, Math.round(bounds.width));
    const height = Math.max(520, Math.round(bounds.height));
    if (canvas.width !== width * scale || canvas.height !== height * scale) {
      canvas.width = width * scale;
      canvas.height = height * scale;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = colors.night;
    context.fillRect(0, 0, width, height);
    const stacked = width < 720;
    if (stacked) {
      drawAudience(phases, 0, 0, width, height / 2, shocked);
      drawGrid(phases, 0, height / 2, width, height / 2, shocked);
      context.fillStyle = colors.night;
      context.fillRect(0, height / 2 - 1, width, 2);
    } else {
      drawAudience(phases, 0, 0, width / 2, height, shocked);
      drawGrid(phases, width / 2, 0, width / 2, height, shocked);
      context.fillStyle = colors.night;
      context.fillRect(width / 2 - 1, 0, 2, height);
    }
    drawGauge(coherence, width, height);
  }

  /** @param {number[]} phases @param {number} x @param {number} y @param {number} width @param {number} height @param {boolean} shocked */
  function drawAudience(phases, x, y, width, height, shocked) {
    context.fillStyle = "#e9dfc5";
    context.fillRect(x, y, width, height);
    drawLabel("THE AUDIENCE", "one pulse = one person's clap", x, y, colors.coral);
    const columns = 8;
    const top = y + 86;
    const plotHeight = height - 112;
    phases.forEach((phase, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const personX = x + ((column + 0.5) / columns) * width;
      const personY = top + ((row + 0.6) / 6) * plotHeight;
      const pulse = (Math.sin(phase) + 1) / 2;
      context.strokeStyle = index < 12 && shocked ? colors.gold : colors.coral;
      context.lineWidth = 1 + pulse * 2.4;
      context.beginPath();
      context.arc(personX, personY, 5 + pulse * 13, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = colors.night;
      context.beginPath();
      context.arc(personX, personY, 4.2, 0, Math.PI * 2);
      context.fill();
    });
  }

  /** @param {number[]} phases @param {number} x @param {number} y @param {number} width @param {number} height @param {boolean} shocked */
  function drawGrid(phases, x, y, width, height, shocked) {
    context.fillStyle = "#10313a";
    context.fillRect(x, y, width, height);
    drawLabel("THE POWER GRID", "one dial = one generator rotor", x, y, colors.cyan);
    const columns = 8;
    const top = y + 86;
    const plotHeight = height - 112;
    context.strokeStyle = "rgba(64, 217, 207, 0.14)";
    context.lineWidth = 1;
    for (let row = 0; row < 6; row += 1) {
      context.beginPath();
      for (let column = 0; column < columns; column += 1) {
        const pointX = x + ((column + 0.5) / columns) * width;
        const pointY = top + ((row + 0.6) / 6) * plotHeight;
        if (column === 0) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
      }
      context.stroke();
    }
    phases.forEach((phase, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const rotorX = x + ((column + 0.5) / columns) * width;
      const rotorY = top + ((row + 0.6) / 6) * plotHeight;
      const radius = Math.max(8, Math.min(15, width / 32));
      context.strokeStyle = index < 12 && shocked ? colors.gold : colors.cyan;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(rotorX, rotorY, radius, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(rotorX, rotorY);
      context.lineTo(rotorX + Math.cos(phase) * radius, rotorY + Math.sin(phase) * radius);
      context.stroke();
      context.fillStyle = colors.cream;
      context.beginPath();
      context.arc(rotorX, rotorY, 2.2, 0, Math.PI * 2);
      context.fill();
    });
  }

  /** @param {string} title @param {string} unit @param {number} x @param {number} y @param {string} color */
  function drawLabel(title, unit, x, y, color) {
    context.fillStyle = color;
    context.font = "700 12px 'Arial Narrow', sans-serif";
    context.fillText(title, x + 22, y + 30);
    context.fillStyle = x === 0 ? colors.night : colors.cream;
    context.font = "12px Georgia, serif";
    context.fillText(unit, x + 22, y + 52);
  }

  /** @param {number} coherence @param {number} width @param {number} height */
  function drawGauge(coherence, width, height) {
    const gaugeWidth = Math.min(360, width - 40);
    const left = (width - gaugeWidth) / 2;
    const top = height - 27;
    context.fillStyle = colors.night;
    context.fillRect(left - 8, top - 12, gaugeWidth + 16, 28);
    context.fillStyle = colors.dim;
    context.fillRect(left, top, gaugeWidth, 3);
    context.fillStyle = coherence > 0.85 ? colors.gold : colors.coral;
    context.fillRect(left, top, gaugeWidth * coherence, 3);
    context.font = "700 9px 'Arial Narrow', sans-serif";
    context.fillText(`COHERENCE ${coherence.toFixed(2)}`, left, top - 4);
  }

  return { render };
}
