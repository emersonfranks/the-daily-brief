// @ts-check

/**
 * Canvas drawing for both panels. No simulation happens here; everything is handed in already
 * measured by inspection-model.js.
 */

/** @typedef {import('./inspection-model.js').Network} Network */

/**
 * Fixed positions for a network, so the picture stays still while the sampler runs over it.
 * High-degree people are pulled toward the middle purely so the eye can find them.
 *
 * @param {Network} network
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, r: number }[]}
 */
export function layoutNetwork(network, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const span = Math.min(width, height) / 2 - 14;
  let maxDegree = 1;
  for (const degree of network.degrees) maxDegree = Math.max(maxDegree, degree);

  return network.degrees.map((degree, index) => {
    const popularity = Math.min(1, Math.log(1 + degree) / Math.log(1 + maxDegree));
    const spiral = Math.sqrt((index + 0.5) / network.size);
    const radius = span * (0.18 + 0.82 * spiral) * (1 - 0.55 * popularity);
    const angle = index * 2.399963229728653;
    return {
      x: cx + radius * Math.cos(angle) * (width / Math.min(width, height)),
      y: cy + radius * Math.sin(angle),
      r: 1.4 + 2.6 * Math.sqrt(degree / maxDegree) * 2,
    };
  });
}

/**
 * @typedef {object} NetworkView
 * @property {Network} network
 * @property {{ x: number, y: number, r: number }[]} layout
 * @property {readonly [number, number] | null} lastEdge
 * @property {number} lastPerson
 * @property {number} meanDegree
 * @property {number} sampledMean
 * @property {number} predictedMean Where 1 + CV² says the sampled mean should land.
 * @property {number} draws
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {NetworkView} view
 */
export function drawNetwork(ctx, width, height, view) {
  ctx.clearRect(0, 0, width, height);
  const { network, layout } = view;

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = 'rgba(124, 196, 255, 0.10)';
  ctx.beginPath();
  for (const [a, b] of network.edges) {
    if (a === b) continue;
    ctx.moveTo(layout[a].x, layout[a].y);
    ctx.lineTo(layout[b].x, layout[b].y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(124, 196, 255, 0.55)';
  for (const point of layout) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (view.lastEdge) {
    const [a, b] = view.lastEdge;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(layout[a].x, layout[a].y);
    ctx.lineTo(layout[b].x, layout[b].y);
    ctx.stroke();

    const chosen = layout[view.lastPerson];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(chosen.x, chosen.y, chosen.r + 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0b0f16';
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(network.degrees[view.lastPerson]), chosen.x, chosen.y + 0.5);
  }

  drawMeter(ctx, width, height, {
    baselineLabel: 'average person',
    baseline: view.meanDegree,
    measuredLabel: 'person found through a friendship',
    measured: view.sampledMean,
    predicted: view.predictedMean,
    unit: ' friends',
    colour: '#7cc4ff',
    draws: view.draws,
  });
}

/**
 * @typedef {object} TimelineView
 * @property {readonly number[]} headways
 * @property {number} windowStart Index of the first headway drawn.
 * @property {number} windowCount
 * @property {{ gap: number, offset: number } | null} lastRider Position of the newest passenger.
 * @property {number} meanHeadway
 * @property {number} meanWait
 * @property {number} predictedWait Where 1 + CV² says the mean wait should land.
 * @property {number} draws
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {TimelineView} view
 */
export function drawTimeline(ctx, width, height, view) {
  ctx.clearRect(0, 0, width, height);

  const left = 14;
  const right = width - 14;
  const axisY = height * 0.46;
  const slice = view.headways.slice(view.windowStart, view.windowStart + view.windowCount);
  const total = slice.reduce((sum, gap) => sum + gap, 0) || 1;
  const scale = (right - left) / total;

  ctx.strokeStyle = 'rgba(255, 180, 84, 0.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, axisY);
  ctx.lineTo(right, axisY);
  ctx.stroke();

  let x = left;
  /** @type {number[]} */
  const stops = [x];
  for (const gap of slice) {
    x += gap * scale;
    stops.push(x);
  }

  for (let i = 0; i < stops.length; i += 1) {
    ctx.strokeStyle = '#ffb454';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(stops[i], axisY - 13);
    ctx.lineTo(stops[i], axisY + 13);
    ctx.stroke();
  }

  for (let i = 0; i < slice.length; i += 1) {
    const mid = (stops[i] + stops[i + 1]) / 2;
    const gapWidth = stops[i + 1] - stops[i];
    if (gapWidth < 26) continue;
    ctx.fillStyle = 'rgba(255, 180, 84, 0.45)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${slice[i].toFixed(1)}m`, mid, axisY + 17);
  }

  if (view.lastRider && view.lastRider.gap >= view.windowStart && view.lastRider.gap < view.windowStart + view.windowCount) {
    const index = view.lastRider.gap - view.windowStart;
    const riderX = stops[index] + view.lastRider.offset * scale;
    const nextX = stops[index + 1];

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(riderX, axisY - 9, Math.max(1, nextX - riderX), 18);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(riderX, axisY - 22);
    ctx.lineTo(riderX, axisY + 22);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`waits ${(slice[index] - view.lastRider.offset).toFixed(1)}m`, riderX, axisY - 25);
  }

  drawMeter(ctx, width, height, {
    baselineLabel: 'half the average gap',
    baseline: view.meanHeadway / 2,
    measuredLabel: 'what a passenger actually waits',
    measured: view.meanWait,
    predicted: view.predictedWait,
    unit: ' min',
    colour: '#ffb454',
    draws: view.draws,
  });
}

/**
 * A two-bar comparison strip pinned to the bottom of a panel, with a marker showing where the
 * formula says the measured bar should stop.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{ baselineLabel: string, baseline: number, measuredLabel: string, measured: number, predicted: number, unit: string, colour: string, draws: number }} spec
 */
function drawMeter(ctx, width, height, spec) {
  const left = 14;
  const right = width - 14;
  const top = height - 62;
  const scale = (right - left) / Math.max(spec.baseline * 2.2, spec.predicted * 1.24, spec.measured * 1.12, 1e-6);

  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(left, top, Math.max(1, spec.baseline * scale), 11);
  ctx.fillStyle = '#98a4b6';
  ctx.fillText(`${spec.baselineLabel}: ${spec.baseline.toFixed(2)}${spec.unit}`, left, top + 21);

  ctx.fillStyle = spec.colour;
  ctx.fillRect(left, top + 32, Math.max(1, spec.measured * scale), 11);

  const markerX = left + spec.predicted * scale;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(markerX, top + 28);
  ctx.lineTo(markerX, top + 47);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('1 + CV\u00b2', markerX, top + 21);

  ctx.textAlign = 'left';
  ctx.fillStyle = spec.colour;
  const trailer = spec.draws === 0 ? '\u2014' : `${spec.measured.toFixed(2)}${spec.unit}`;
  ctx.fillText(`${spec.measuredLabel}: ${trailer}`, left, top + 53);
}
