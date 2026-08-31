// @ts-check

/** @typedef {import('./network.js').ScenarioResult} ScenarioResult */

/** @param {HTMLCanvasElement} canvas @param {'ecology' | 'software'} vocabulary */
export function createNetworkRenderer(canvas, vocabulary) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  const colors = vocabulary === 'ecology'
    ? { healthy: '#c9f25b', weak: '#ef512f', link: '#637066' }
    : { healthy: '#62b9ca', weak: '#ef512f', link: '#596c75' };

  /** @param {ScenarioResult} result @param {number} frame */
  function draw(result, frame) {
    const width = canvas.width;
    const height = canvas.height;
    const snapshot = result.snapshots[Math.min(frame, result.snapshots.length - 1)];
    if (!snapshot) return;
    const positions = result.nodes.map((node, index) => {
      const angle = index / result.nodes.length * Math.PI * 2 - Math.PI / 2;
      const ring = index % 3;
      const radius = Math.min(width, height) * (0.18 + ring * 0.105);
      return { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius };
    });
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1.2;
    for (const link of result.links) {
      const from = positions[link.from];
      const to = positions[link.to];
      if (!from || !to) continue;
      context.globalAlpha = snapshot.activeMask[link.from] && snapshot.activeMask[link.to] ? 0.34 : 0.06;
      context.strokeStyle = colors.link;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const active = snapshot.activeMask[index];
      const value = snapshot.values[index] ?? 0;
      const radius = 5 + value * 10;
      context.globalAlpha = active ? 1 : 0.25;
      context.fillStyle = value > 0.42 ? colors.healthy : colors.weak;
      context.strokeStyle = active ? context.fillStyle : '#f2ecdc';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(position.x, position.y, active ? radius : 7, 0, Math.PI * 2);
      if (active) context.fill();
      else context.stroke();
    }
    context.globalAlpha = 1;
    context.fillStyle = '#f2ecdc';
    context.textAlign = 'center';
    context.font = '700 20px "Courier New", monospace';
    context.fillText(frame < 45 ? 'STEADY' : frame < 95 ? 'SHOCK' : 'AFTER', width / 2, height / 2 - 3);
    context.font = '13px "Courier New", monospace';
    context.fillStyle = frame >= 45 && frame < 95 ? colors.weak : colors.healthy;
    context.fillText(`${snapshot.active}/30 ACTIVE`, width / 2, height / 2 + 22);
  }

  return { draw };
}
