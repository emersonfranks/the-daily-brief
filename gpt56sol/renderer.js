// @ts-check

import { links, reactionCapacity, reactions } from './network.js';

const colors = {
  ink: '#152322',
  dim: '#6b7771',
  vent: '#ff7a45',
  bacteria: '#16a085',
  archaea: '#7d66d9',
  paper: '#f4efe4',
  dark: '#10211f'
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./network.js').State} state
 * @param {'cell' | 'town'} vocabulary
 * @param {number} phase
 */
export function drawNetwork(canvas, state, vocabulary, phase) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = vocabulary === 'cell' ? colors.dark : colors.paper;
  context.fillRect(0, 0, width, height);

  const point = (index) => ({
    x: 22 + reactions[index].x * (width - 54),
    y: 18 + reactions[index].y * (height - 54)
  });

  for (const [from, to] of links) {
    const start = point(from);
    const end = point(to);
    context.strokeStyle = vocabulary === 'cell' ? '#31534e' : '#cabfae';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();

    const progress = (phase + from * 0.13) % 1;
    context.fillStyle = state.lineage === 'bacteria' ? colors.bacteria : colors.archaea;
    context.beginPath();
    context.arc(
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress,
      3.5,
      0,
      Math.PI * 2
    );
    context.fill();
  }

  reactions.forEach((reaction, index) => {
    const { x, y } = point(index);
    const capacity = reactionCapacity(index, state);
    const localShare = reaction.inherited ? 1 : 1 - state.support;
    const localColor = state.lineage === 'bacteria' ? colors.bacteria : colors.archaea;

    context.fillStyle = vocabulary === 'cell' ? '#152f2b' : '#fffaf0';
    context.strokeStyle = capacity < 0.99 ? '#d64545' : localShare > 0.5 ? localColor : colors.vent;
    context.lineWidth = capacity < 0.99 ? 4 : 2.5;
    context.beginPath();
    if (!reaction.inherited && localShare > 0.5) {
      const sides = state.lineage === 'bacteria' ? 4 : 6;
      for (let side = 0; side < sides; side += 1) {
        const angle = -Math.PI / 2 + side * Math.PI * 2 / sides;
        const px = x + Math.cos(angle) * 10;
        const py = y + Math.sin(angle) * 10;
        if (side === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    } else {
      context.arc(x, y, 10, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();

    context.font = '500 10px "Segoe UI", sans-serif';
    context.textAlign = 'center';
    context.fillStyle = vocabulary === 'cell' ? '#d4ddd8' : colors.ink;
    context.fillText(reaction[vocabulary], x, y + 24);
  });

  const geology = Math.round(state.support * 100);
  context.textAlign = 'left';
  context.font = '700 11px "Segoe UI", sans-serif';
  context.fillStyle = colors.vent;
  context.fillText(`SHARED SUPPORT ${geology}%`, 14, 18);
}
