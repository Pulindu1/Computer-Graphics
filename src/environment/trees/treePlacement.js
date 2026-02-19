/**
 * treePlacement.js
 * Tree placement using candidate sampling + rejection.
 *
 * Algorithm:
 *  - Sample (x,z) randomly within bounds
 *  - Reject if: inside river corridor, on street, on walkway, slope too steep, height too low
 *  - Reject if too close to another accepted tree (spacing check via spatial grid)
 *  - O(k) per placement where k is a small constant (~9 cells × bucket size)
 *    vs O(n) brute-force — critical for 1000+ trees
 */

// Cell-key for the occupancy grid (no allocation on modern V8 — string template is JIT-optimised)
function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

/**
 * Generate tree placement instances.
 *
 * @param {object} params
 *   count         – target number of trees
 *   minX,maxX,minZ,maxZ – world-space bounds
 *   minSpacing    – minimum distance between any two trees (world units)
 *   riverMargin   – exclusion zone around river corridor (beyond half-width)
 *   streetMargin  – exclusion zone beyond street rectangle edges
 *   walkwayMargin – exclusion zone around walkway band
 *   maxSlope2     – maximum squared slope magnitude (||∇h||²) for placement
 *   minHeight     – reject vertices below this world-Y (avoids riverbed/low basins)
 *   maxAttempts   – budget multiplier (default: count × 30)
 *
 * @param {object} terrainQuery
 *   { getHeightAt, getSlopeAt, isInsideRiver, isOnStreet, isOnWalkway? }
 *
 * @returns {Array<{x,y,z,rotY,scale,variantSeed}>}
 */
export function generateTreeInstances(params, terrainQuery) {
  const {
    count         = 800,
    minX          = -400,
    maxX          =  400,
    minZ          = -1000,
    maxZ          =  1000,
    minSpacing    = 18,
    riverMargin   = 12,
    streetMargin  = 10,
    walkwayMargin = 8,
    maxSlope2     = 0.5,
    minHeight     = -3,
    maxAttempts,
  } = params;

  const budget   = maxAttempts ?? count * 30;
  const cellSize = minSpacing;   // grid cell ≈ minSpacing → 3×3 search always sufficient

  // Spatial occupancy grid: Map<"cx,cz" → Array<{x,z}>>
  const grid = new Map();
  const out  = [];

  // ---- helpers ----

  function isOccupied(x, z) {
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    const ms2 = minSpacing * minSpacing;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const arr = grid.get(cellKey(cx + dx, cz + dz));
        if (!arr) continue;
        for (const p of arr) {
          const ddx = x - p.x, ddz = z - p.z;
          if (ddx * ddx + ddz * ddz < ms2) return true;
        }
      }
    }
    return false;
  }

  function occupy(x, z) {
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    const key = cellKey(cx, cz);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push({ x, z });
  }

  // ---- sampling loop ----

  let attempt = 0;
  while (out.length < count && attempt < budget) {
    attempt++;

    const x = minX + Math.random() * (maxX - minX);
    const z = minZ + Math.random() * (maxZ - minZ);

    // --- Rejection tests (cheapest first) ---

    // 1. River corridor + margin
    if (terrainQuery.isInsideRiver(x, z, riverMargin)) continue;

    // 2. Street rectangle + margin
    if (terrainQuery.isOnStreet(x, z, streetMargin)) continue;

    // 3. Walkway band + margin (optional — query may not expose this)
    if (terrainQuery.isOnWalkway?.(x, z, walkwayMargin)) continue;

    // 4. Slope (squared to avoid sqrt): reject very steep terrain
    //    getSlopeAt returns ||∇h||² already
    const slope2 = terrainQuery.getSlopeAt(x, z);
    if (slope2 > maxSlope2) continue;

    // 5. Height gate — reject very low areas (riverbed, flooded zones)
    const y = terrainQuery.getHeightAt(x, z);
    if (y < minHeight) continue;

    // 6. Spacing (occupancy grid) — most expensive, so last
    if (isOccupied(x, z)) continue;

    // ---- Accept ----
    out.push({
      x,
      y,
      z,
      rotY:        Math.random() * Math.PI * 2,
      scale:       8.0 + Math.random() * 7.0,   // 8.0 – 15.0 (10× world scale)
      variantSeed: Math.random(),
      type:        Math.random() < 0.4 ? 'small' : 'large',  // 40% small, 60% large trees
    });
    occupy(x, z);
  }

  return out;
}
