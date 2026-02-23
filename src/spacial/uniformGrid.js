

export class UniformGrid {
  constructor(cellSize = 10) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.buckets = new Map(); // key -> array of ids
  }

  clear() {
    this.buckets.clear();
  }

  worldToCell(x, z) {
    const cx = Math.floor(x * this.invCellSize);
    const cz = Math.floor(z * this.invCellSize);
    return { cx, cz };
  }

  cellKey(cx, cz) {
    return `${cx},${cz}`;
  }

  insert(id, x, z) {
    const { cx, cz } = this.worldToCell(x, z);
    const key = this.cellKey(cx, cz);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(id);
  }

  getBucket(cx, cz) {
    return this.buckets.get(this.cellKey(cx, cz)) || null;
  }

  getNeighbourBuckets(x, z, radiusInCells = 1) {
    const { cx, cz } = this.worldToCell(x, z);
    const out = [];

    for (let dz = -radiusInCells; dz <= radiusInCells; dz++) {
      for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
        const b = this.getBucket(cx + dx, cz + dz);
        if (b && b.length) out.push(b);
      }
    }
    return out;
  }


  getOccupiedCells() {
    const cells = [];
    for (const [key, bucket] of this.buckets.entries()) {
      const [cxStr, czStr] = key.split(",");
      cells.push({
        cx: parseInt(cxStr, 10),
        cz: parseInt(czStr, 10),
        count: bucket.length,
      });
    }
    return cells;
  }
}
