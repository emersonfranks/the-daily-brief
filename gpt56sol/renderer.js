// @ts-check

/** @typedef {import('./memory.js').Experiment} Experiment */

const COLORS = {
  ink: '#f5f1e8',
  dim: '#80918c',
  grid: '#26322f',
  fluid: '#57d6e6',
  account: '#d8ff4f',
};

/** @param {CanvasRenderingContext2D} context @param {number} x @param {number} y @param {number} width @param {number} height */
function drawGrid(context, x, y, width, height) {
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  for (let column = 0; column <= 10; column += 1) {
    const lineX = x + width * column / 10;
    context.beginPath();
    context.moveTo(lineX, y);
    context.lineTo(lineX, y + height);
    context.stroke();
  }
  for (let row = 0; row <= 4; row += 1) {
    const lineY = y + height * row / 4;
    context.beginPath();
    context.moveTo(x, lineY);
    context.lineTo(x + width, lineY);
    context.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {Experiment} experiment
 * @param {{x: number, y: number, width: number, height: number, label: string, subtitle: string, color: string}} panel
 */
function drawPanel(context, experiment, panel) {
  const { x, y, width, height, label, subtitle, color } = panel;
  const plotX = x + 16;
  const plotWidth = width - 32;
  const signalY = y + 74;
  const signalHeight = height * 0.31;
  const heldY = signalY + signalHeight + 34;
  const heldHeight = height * 0.27;
  const signalMid = signalY + signalHeight / 2;
  const heldMid = heldY + heldHeight / 2;
  const signalScale = signalHeight / (experiment.options.amplitude * 2.1);
  const heldScale = heldHeight / (experiment.options.amplitude * 2.2);

  context.fillStyle = '#151d1b';
  context.fillRect(x, y, width, height);
  context.fillStyle = color;
  context.font = '700 12px "Trebuchet MS", sans-serif';
  context.fillText(label.toUpperCase(), x + 16, y + 24);
  context.fillStyle = COLORS.dim;
  context.font = '12px "Trebuchet MS", sans-serif';
  context.fillText(subtitle, x + 16, y + 44);

  drawGrid(context, plotX, signalY, plotWidth, signalHeight);
  drawGrid(context, plotX, heldY, plotWidth, heldHeight);

  context.fillStyle = COLORS.dim;
  context.font = '10px "Trebuchet MS", sans-serif';
  context.fillText('INPUT', plotX, signalY - 8);
  context.fillText('HELD STATE', plotX, heldY - 8);

  const xForTime = (/** @type {number} */ time) => plotX + time / 20 * plotWidth;
  context.beginPath();
  for (let index = 0; index < experiment.samples.length; index += 1) {
    const sample = experiment.samples[index];
    const pointX = xForTime(sample.time);
    const pointY = signalMid - sample.signal * signalScale;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.strokeStyle = color;
  context.lineWidth = 2.5;
  context.stroke();

  context.beginPath();
  context.moveTo(plotX, heldMid);
  for (const sample of experiment.samples) {
    context.lineTo(xForTime(sample.time), heldMid - sample.cumulative * heldScale);
  }
  context.lineTo(plotX + plotWidth, heldMid);
  context.closePath();
  context.fillStyle = `${color}24`;
  context.fill();

  context.beginPath();
  for (let index = 0; index < experiment.samples.length; index += 1) {
    const sample = experiment.samples[index];
    const pointX = xForTime(sample.time);
    const pointY = heldMid - sample.cumulative * heldScale;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = COLORS.dim;
  context.font = '10px "Trebuchet MS", sans-serif';
  context.fillText('0', plotX, heldY + heldHeight + 17);
  context.textAlign = 'right';
  context.fillText('20', plotX + plotWidth, heldY + heldHeight + 17);
  context.textAlign = 'left';
}

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');

  return {
    /** @param {Experiment} experiment */
    draw(experiment) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#0d1312';
      context.fillRect(0, 0, width, height);

      const stacked = width < 720;
      const gap = 12;
      const panelWidth = stacked ? width - 24 : (width - 36) / 2;
      const panelHeight = stacked ? (height - 36) / 2 : height - 24;
      const firstPanel = { x: 12, y: 12, width: panelWidth, height: panelHeight };
      const secondPanel = stacked
        ? { x: 12, y: 12 + panelHeight + gap, width: panelWidth, height: panelHeight }
        : { x: 12 + panelWidth + gap, y: 12, width: panelWidth, height: panelHeight };

      drawPanel(context, experiment, {
        ...firstPanel,
        label: 'Superfluid',
        subtitle: 'pressure impulse / prepotential trace',
        color: COLORS.fluid,
      });
      drawPanel(context, experiment, {
        ...secondPanel,
        label: 'Bank account',
        subtitle: 'cash flow / balance trace',
        color: COLORS.account,
      });
    },
  };
}