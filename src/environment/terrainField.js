

/**
 * Parametric terrain field API
 * Provides continuous height, gradient, and slope evaluation
 * @param {Function} sampleHeightFn - Function that takes (x, z) and returns height
 */
export function makeTerrainField(sampleHeightFn) {
  // Height at any world position
  function height(x, z) {
    return sampleHeightFn(x, z);
  }

  function gradient(x, z) {
    const e = 0.5;
    const hx1 = height(x + e, z);
    const hx0 = height(x - e, z);
    const hz1 = height(x, z + e);
    const hz0 = height(x, z - e);
    const dhdx = (hx1 - hx0) / (2 * e);
    const dhdz = (hz1 - hz0) / (2 * e);
    return { dhdx, dhdz };
  }

  // Slope magnitude (steepness)
  function slope(x, z) {
    const g = gradient(x, z);
    return Math.hypot(g.dhdx, g.dhdz);
  }

  return { height, gradient, slope };
}
