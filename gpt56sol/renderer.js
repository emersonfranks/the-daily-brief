// @ts-check

/** @typedef {import("./branching.js").BranchingRun} BranchingRun */

const palette = {
  ink: "#181816",
  paper: "#f3f0e8",
  mail: "#197f91",
  mailSoft: "#7fc7cf",
  atom: "#d04432",
  atomSoft: "#ef9b80",
  muted: "#77736a",
};

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable");

  /**
   * @param {BranchingRun} run
   * @param {number} visibleGeneration
   */
  function render(run, visibleGeneration) {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(640, Math.round(bounds.width));
    const height = Math.max(460, Math.round(bounds.height));
    if (canvas.width !== width * scale || canvas.height !== height * scale) {
      canvas.width = width * scale;
      canvas.height = height * scale;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = palette.paper;
    context.fillRect(0, 0, width, height);

    const gap = width < 820 ? 18 : 42;
    const panelWidth = (width - gap) / 2;
    drawWorld(run, visibleGeneration, 0, panelWidth, height, "mail");
    drawWorld(run, visibleGeneration, panelWidth + gap, panelWidth, height, "atom");
  }

  /**
   * @param {BranchingRun} run
   * @param {number} visibleGeneration
   * @param {number} offsetX
   * @param {number} panelWidth
   * @param {number} height
   * @param {"mail" | "atom"} world
   */
  function drawWorld(run, visibleGeneration, offsetX, panelWidth, height, world) {
    const color = world === "mail" ? palette.mail : palette.atom;
    const soft = world === "mail" ? palette.mailSoft : palette.atomSoft;
    const title = world === "mail" ? "THE REPLY CHAIN" : "THE FISSION CHAIN";
    const unit = world === "mail" ? "one dot = one sent reply" : "one dot = one fission event";
    const top = 96;
    const plotHeight = height - top - 34;
    const maxGeneration = Math.max(1, run.generations.length - 1);
    const visibleNodes = run.nodes.filter((node) => node.generation <= visibleGeneration);
    const byGeneration = new Map();
    for (const node of visibleNodes) {
      const group = byGeneration.get(node.generation) ?? [];
      group.push(node);
      byGeneration.set(node.generation, group);
    }

    context.fillStyle = color;
    context.font = "700 13px 'Arial Narrow', sans-serif";
    context.fillText(title, offsetX + 18, 30);
    context.fillStyle = palette.ink;
    context.font = "600 12px Georgia, serif";
    context.fillText(unit, offsetX + 18, 52);
    context.fillStyle = palette.muted;
    context.font = "11px 'Arial Narrow', sans-serif";
    context.fillText(`GENERATION ${Math.min(visibleGeneration, maxGeneration)} / ${maxGeneration}`, offsetX + 18, 75);

    context.strokeStyle = "rgba(24, 24, 22, 0.12)";
    context.lineWidth = 1;
    for (let generation = 0; generation <= maxGeneration; generation += 2) {
      const x = offsetX + 22 + (generation / maxGeneration) * (panelWidth - 44);
      context.beginPath();
      context.moveTo(x, top - 8);
      context.lineTo(x, height - 20);
      context.stroke();
    }

    /** @type {Map<number, {x: number, y: number}>} */
    const positions = new Map();
    for (const [generation, nodes] of byGeneration) {
      nodes.forEach((node, index) => {
        const x = offsetX + 22 + (generation / maxGeneration) * (panelWidth - 44);
        const distributed = (index + 1) / (nodes.length + 1);
        const y = top + distributed * plotHeight;
        positions.set(node.id, { x, y });
      });
    }

    context.strokeStyle = soft;
    context.lineWidth = 1.2;
    for (const node of visibleNodes) {
      if (node.parentId === null) continue;
      const start = positions.get(node.parentId);
      const end = positions.get(node.id);
      if (!start || !end) continue;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.bezierCurveTo((start.x + end.x) / 2, start.y, (start.x + end.x) / 2, end.y, end.x, end.y);
      context.stroke();
    }

    for (const node of visibleNodes) {
      const position = positions.get(node.id);
      if (!position) continue;
      if (world === "mail") drawMail(position.x, position.y, color, node.generation === visibleGeneration);
      else drawAtom(position.x, position.y, color, node.generation === visibleGeneration);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {boolean} newest
   */
  function drawMail(x, y, color, newest) {
    context.fillStyle = newest ? color : palette.paper;
    context.strokeStyle = color;
    context.lineWidth = 1.4;
    context.fillRect(x - 4.5, y - 3.4, 9, 6.8);
    context.strokeRect(x - 4.5, y - 3.4, 9, 6.8);
    context.beginPath();
    context.moveTo(x - 4, y - 2.8);
    context.lineTo(x, y + 0.2);
    context.lineTo(x + 4, y - 2.8);
    context.stroke();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {boolean} newest
   */
  function drawAtom(x, y, color, newest) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, newest ? 4.2 : 3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 0.8;
    context.beginPath();
    context.ellipse(x, y, 6.5, 2.4, Math.PI / 5, 0, Math.PI * 2);
    context.stroke();
  }

  return { render };
}
