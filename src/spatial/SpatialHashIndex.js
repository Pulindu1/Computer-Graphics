// 📄 src/spatial/SpatialHashIndex.js
/**
 * ISpatialIndex wrapper around the existing integer-key spatial hash.
 * Drop-in replacement: delegates to SpatialHashGrid (CrowdZoneWalkway)
 * or the inline SpatialHash class (StreetPedestrians) via the same interface.
 *
 * Uses the same allocation-free strategy: stable buckets, packKey integers.
 */
import { ISpatialIndex } from "./ISpatialIndex.js";
import { cellCoord, packKey } from "../spacial/hashKey.js";

export class SpatialHashIndex extends ISpatialIndex {
  /**
   * @param {number} cellSize – grid cell side length (world units)
   */
  constructor(cellSize = 4.0) {
    super();
    this.cellSize = cellSize;
    this._map = new Map(); // packed int key → agent[]
    this._totalCandidates = 0;
  }

  // ── ISpatialIndex ──────────────────────────────────────────────────

  clear() {
    const t0 = performance.now();
    for (const bucket of this._map.values()) bucket.length = 0;
    this.stats.buildMs = performance.now() - t0; // just the clear cost
    this.stats.queriesThisFrame = 0;
    this.stats.queryMs = 0;
    this._totalCandidates = 0;
  }

  insert(agent) {
    const t0 = performance.now();
    const cx = cellCoord(agent.pos.x, this.cellSize);
    const cz = cellCoord(agent.pos.z, this.cellSize);
    const key = packKey(cx, cz);
    if (!this._map.has(key)) this._map.set(key, []);
    this._map.get(key).push(agent);
    this.stats.buildMs += performance.now() - t0;
  }

  /**
   * Fill `out` with all agents in the (2r+1)×(2r+1) cell neighbourhood.
   * Caller must distance-filter after.
   */
  queryInto(x, z, radius, out) {
    const t0 = performance.now();
    out.length = 0;
    const rCells = Math.ceil(radius / this.cellSize);
    const cx0 = cellCoord(x, this.cellSize);
    const cz0 = cellCoord(z, this.cellSize);

    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const bucket = this._map.get(packKey(cx0 + dx, cz0 + dz));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }

    this.stats.queryMs += performance.now() - t0;
    this.stats.queriesThisFrame++;
    this._totalCandidates += out.length;
    this.stats.candidatesAvg = this._totalCandidates / this.stats.queriesThisFrame;
    return out;
  }
}
