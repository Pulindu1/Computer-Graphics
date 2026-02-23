

function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

/**
 * Generate vegetation instances (rocks, stumps).
 *
 * @param {object} params
 *   count, minX, maxX, minZ, maxZ, minSpacing, riverMargin, streetMargin, walkwayMargin
 * @param {object} terrainQuery
 * @returns {Array<{x,y,z,rotY,type}>}
 */
export function generateVegetationInstances(params, terrainQuery) {
  const {
    count         = 400,
    minX          = -400,
    maxX          =  400,
    minZ          = -1000,
    maxZ          =  1000,
    minSpacing    = 8, 
    riverMargin   = 12,
    streetMargin  = 55,
    walkwayMargin = 8,
    maxSlope2     = 3.0,
    minHeight     = -3,
    maxAttempts,
  } = params;

  const budget   = maxAttempts ?? count * 30;
  const cellSize = minSpacing;

  const grid = new Map();
  const out  = [];

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

  let attempt = 0;
  while (out.length < count && attempt < budget) {
    attempt++;

    const x = minX + Math.random() * (maxX - minX);
    const z = minZ + Math.random() * (maxZ - minZ);

    // Rejection tests
    if (terrainQuery.isInsideRiver(x, z, riverMargin)) continue;
    if (terrainQuery.isOnStreet(x, z, streetMargin)) continue;
    if (terrainQuery.isOnWalkway?.(x, z, walkwayMargin)) continue;

    const slope2 = terrainQuery.getSlopeAt(x, z);
    if (slope2 > maxSlope2) continue;

    const y = terrainQuery.getHeightAt(x, z);
    if (y < minHeight) continue;

    if (isOccupied(x, z)) continue;

    // Accept (rocks only)
    out.push({
      x,
      y,
      z,
      rotY: Math.random() * Math.PI * 2,
      type: 'rock',
    });
    occupy(x, z);
  }

  return out;
}
