// @ts-check

/**
 * The landing page ornament: two ring lattices at slightly different pitch. Neither layer contains
 * the large soft pattern you actually see — that belongs to the interference between them, which is
 * the whole premise of this site rendered as its own decoration. The pointer moves one lattice
 * against the other, so the reader supplies the coupling.
 */

const AMBER = '240, 195, 104';
const STEEL = '127, 157, 196';
const PITCH_A = 23;
const PITCH_B = 24.15;

const canvas = document.getElementById('field');
if (canvas instanceof HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (context) start(canvas, context);
}

/**
 * @param {HTMLCanvasElement} surface
 * @param {CanvasRenderingContext2D} context
 */
function start(surface, context) {
  const stillOnly = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let width = 0;
  let height = 0;
  let frame = 0;

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    surface.width = Math.round(width * ratio);
    surface.height = Math.round(height * ratio);
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /**
   * One family of concentric rings, drawn to the far corner so the lattice always fills the frame.
   * @param {number} centreX
   * @param {number} centreY
   * @param {number} pitch
   * @param {string} rgb
   * @param {number} alpha
   */
  function rings(centreX, centreY, pitch, rgb, alpha) {
    const reach = Math.hypot(
      Math.max(centreX, width - centreX),
      Math.max(centreY, height - centreY)
    );
    context.strokeStyle = `rgba(${rgb}, ${alpha})`;
    context.lineWidth = 1;
    for (let radius = pitch; radius < reach; radius += pitch) {
      context.beginPath();
      context.arc(centreX, centreY, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function draw() {
    const time = stillOnly ? 0 : frame / 60;
    pointer.x += (pointer.targetX - pointer.x) * 0.04;
    pointer.y += (pointer.targetY - pointer.y) * 0.04;

    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    const driftX = Math.cos(time * 0.11) * 34;
    const driftY = Math.sin(time * 0.09) * 22;

    rings(width * 0.44 - driftX, height * 0.34 - driftY, PITCH_A, AMBER, 0.3);
    rings(
      width * 0.56 + driftX + pointer.x * 46,
      height * 0.44 + driftY + pointer.y * 46,
      PITCH_B,
      STEEL,
      0.26
    );

    context.globalCompositeOperation = 'source-over';
    frame++;
    if (!stillOnly) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    if (stillOnly) draw();
  });

  window.addEventListener('pointermove', (event) => {
    pointer.targetX = event.clientX / window.innerWidth - 0.5;
    pointer.targetY = event.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  resize();
  draw();
  document.body.classList.add('field-live');
}
