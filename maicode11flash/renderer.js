export function renderGrid(element, cells) {
  element.innerHTML = '';
  for (const row of cells) {
    for (const cell of row) {
      const node = document.createElement('div');
      node.className = `cell${cell ? ' active' : ''}`;
      element.appendChild(node);
    }
  }
}
