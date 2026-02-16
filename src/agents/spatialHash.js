// 📄 src/agents/spatialHash.js
import { Stats } from "../stats.js";

export function createSpatialHash(cellSize = 20) {
  const inv = 1 / cellSize;
  const buckets = new Map(); // key -> array of indices

  function key(ix, iz) {
    // string key is fine for this scale; later you can optimize to int packing
    return `${ix},${iz}`;
  }

  function worldToCell(x, z) {
    return { ix: Math.floor(x * inv), iz: Math.floor(z * inv) };
  }

  function clear() {
    buckets.clear();
  }

  function insert(index, x, z) {
    const { ix, iz } = worldToCell(x, z);
    const k = key(ix, iz);
    let arr = buckets.get(k);
    if (!arr) {
      arr = [];
      buckets.set(k, arr);
    }
    arr.push(index);
  }

  // Collect neighbor indices within +/-rCells in grid
  function query(x, z, rCells = 1, out = []) {
    out.length = 0;
    const { ix, iz } = worldToCell(x, z);

    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        Stats.queriedCells++; // Track cells accessed
        const arr = buckets.get(key(ix + dx, iz + dz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }

  return { cellSize, clear, insert, query };
}
