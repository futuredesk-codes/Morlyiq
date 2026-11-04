import { RESOURCES, PERMS } from "../constants/navigation.js";

export function emptyGrid() {
  const g = {};
  RESOURCES.forEach((r) => {
    g[r] = {};
    PERMS.forEach((p) => {
      g[r][p] = false;
    });
  });
  return g;
}

export function grid(overrides = {}) {
  const g = emptyGrid();
  Object.entries(overrides).forEach(([res, perms]) => {
    perms.forEach((p) => {
      if (g[res]) g[res][p] = true;
    });
  });
  return g;
}

export function allTrueGrid() {
  const g = emptyGrid();
  RESOURCES.forEach((r) =>
    PERMS.forEach((p) => {
      g[r][p] = true;
    })
  );
  return g;
}

export function countGranted(permGrid) {
  let n = 0;
  RESOURCES.forEach((r) =>
    PERMS.forEach((p) => {
      if (permGrid && permGrid[r] && permGrid[r][p]) n++;
    })
  );
  return n;
}
