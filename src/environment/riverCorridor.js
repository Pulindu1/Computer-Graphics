export function makeRiverCorridor({
  width = 800,
  length = 800,
  waterLevel = -6,
  riverHalfWidth = 56,
  riverMeanderAmp = 55,
  riverMeanderWavelength = 140,
  seedishOffset = 13.37,
} = {}) {
  const zMin = -length / 2;
  const zMax = +length / 2;

  function centerX(z) {
    return (
      Math.sin((z + seedishOffset) / riverMeanderWavelength) * riverMeanderAmp +
      Math.sin((z - seedishOffset) / (riverMeanderWavelength * 0.55)) *
        (riverMeanderAmp * 0.35)
    );
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function clampXToRiver(x, z, margin = 0) {
    const cx = centerX(z);
    const dx = x - cx;
    const dxClamped = clamp(dx, -riverHalfWidth + margin, +riverHalfWidth - margin);
    return cx + dxClamped;
  }


  function clampDx(dx, margin = 0) {
    return clamp(dx, -riverHalfWidth + margin, +riverHalfWidth - margin);
  }

  return {
    width,
    length,
    zMin,
    zMax,
    waterLevel,
    riverHalfWidth,
    centerX,
    clampXToRiver,
    clampDx,
  };
}
