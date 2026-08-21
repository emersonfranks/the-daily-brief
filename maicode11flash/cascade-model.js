export function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function countActive(cells) {
  return cells.reduce((total, row) => total + row.reduce((sum, cell) => sum + (cell ? 1 : 0), 0), 0);
}

export function buildScenario({ rows = 12, cols = 12, threshold = 3, density = 0.18, seed = 1 } = {}) {
  const random = mulberry32(seed);
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (random() < density ? 1 : 0)),
  );

  return {
    rows,
    cols,
    threshold,
    density,
    seed,
    cells,
  };
}

export function countNeighbors(cells, row, col) {
  let count = 0;
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      if (x === 0 && y === 0) {
        continue;
      }
      const nextRow = row + y;
      const nextCol = col + x;
      if (
        nextRow >= 0 &&
        nextRow < cells.length &&
        nextCol >= 0 &&
        nextCol < cells[nextRow].length &&
        cells[nextRow][nextCol] === 1
      ) {
        count += 1;
      }
    }
  }
  return count;
}

export function stepScenario(scenario) {
  const nextCells = scenario.cells.map((row) => row.slice());
  let changed = 0;

  for (let row = 0; row < scenario.rows; row += 1) {
    for (let col = 0; col < scenario.cols; col += 1) {
      const active = nextCells[row][col] === 1;
      const neighbors = countNeighbors(nextCells, row, col);
      if (!active && neighbors >= scenario.threshold) {
        nextCells[row][col] = 1;
        changed += 1;
      }
    }
  }

  return {
    ...scenario,
    cells: nextCells,
    changed,
  };
}

export function runCascade(scenario, maxSteps = 40) {
  let state = {
    ...scenario,
    cells: scenario.cells.map((row) => row.slice()),
  };

  const history = [{ step: 0, activeCount: countActive(state.cells) }];

  for (let step = 1; step <= maxSteps; step += 1) {
    const nextState = stepScenario(state);
    history.push({ step, activeCount: countActive(nextState.cells), changed: nextState.changed });
    state = nextState;
    if (nextState.changed === 0) {
      break;
    }
  }

  return {
    history,
    finalState: state,
    activeCount: countActive(state.cells),
  };
}

export function exploreCascadeSeries(densities = [0.1, 0.14, 0.18, 0.22, 0.26], threshold = 3) {
  return densities.map((density, index) => {
    const scenario = buildScenario({ rows: 14, cols: 14, threshold, density, seed: 9101 + index * 97 });
    const result = runCascade(scenario, 30);
    return {
      density,
      activeCount: result.activeCount,
      steps: result.history.length - 1,
    };
  });
}

export function compareThresholds() {
  const lowThreshold = runCascade(buildScenario({ rows: 14, cols: 14, threshold: 2, density: 0.18, seed: 2024 }));
  const highThreshold = runCascade(buildScenario({ rows: 14, cols: 14, threshold: 4, density: 0.18, seed: 2024 }));

  return {
    threshold2: lowThreshold.activeCount,
    threshold4: highThreshold.activeCount,
  };
}
