

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// River centreline meanders in X as Z changes
function riverCenterX(z, p) {
  return (
    Math.sin((z + p.seedishOffset) / p.riverMeanderWavelength) * p.riverMeanderAmp +
    Math.sin((z - p.seedishOffset) / (p.riverMeanderWavelength * 0.55)) * (p.riverMeanderAmp * 0.35)
  );
}

export function createTerrainSampler(params = {}) {
  const p = {
    // Base terrain undulation
    baseAmplitude: 12,
    baseWavelength: 220,
    secondaryAmplitude: 4,
    secondaryWavelength: 110,


    riverMeanderAmp: 55,
    riverMeanderWavelength: 140,

    // River cross-section
    riverHalfWidth: 56,
    riverBlend: 16,
    riverDepth: 14,
    waterLevel: -6,


    // Walkway band (either side of river)
    walkwayWidth: 32,
    walkwayBlend: 20,
    walkwayLift: 0.3,

    // Hills shaping
    leftHillMultiplier: 1.4,
    rightHillMultiplier: 1.4,

 
    valleyMaxHeight: 180,
    floodplainWidth: 30,
    rampWidth: 240,

    rampPower: 2.6,

    seedishOffset: 13.37,

    ...params,
  };

  function sample(x, z) {
    const cx = riverCenterX(z, p);
    const d = Math.abs(x - cx);

    // Smooth base height
    const base =
      Math.sin((x + p.seedishOffset) / p.baseWavelength) * p.baseAmplitude +
      Math.cos((z - p.seedishOffset) / (p.baseWavelength * 0.95)) * (p.baseAmplitude * 0.55) +
      Math.sin((x + z) / p.secondaryWavelength) * p.secondaryAmplitude;

    // Asymmetry
    const sideMul = 1.0; // Both sides equal
    

    const rampD = Math.max(0, d - p.floodplainWidth);
    const tRamp = smoothstep(0, p.rampWidth, rampD);
    const steepRamp = Math.pow(tRamp, p.rampPower);
    const slopeMul = 1.05;

    const valley = steepRamp * p.valleyMaxHeight * slopeMul;

    const plateauStart = 280;
    const plateauHeight = base * sideMul + valley;
    
    let finalHill;
    if (d >= plateauStart) {

      finalHill = plateauHeight;
    } else {

      finalHill = base * sideMul + valley;
    }


    const riverInner = p.riverHalfWidth;
    const riverOuter = p.riverHalfWidth + p.riverBlend;
    const riverMask = 1.0 - smoothstep(riverInner, riverOuter, d);

    const wIn = p.riverHalfWidth;
    const wOut = p.riverHalfWidth + p.walkwayWidth;

    const walkwayRingMask =
      smoothstep(wIn, wIn + p.walkwayBlend, d) *
      (1.0 - smoothstep(wOut, wOut + p.walkwayBlend, d));

    let y = finalHill;

    y = y * (1.0 - riverMask) + p.waterLevel * riverMask;



    const walkwayY = p.waterLevel + p.walkwayLift;


    const walkwayCoreMask = Math.pow(walkwayRingMask, 1.2);
    const walkwayEdgeMask = walkwayRingMask - walkwayCoreMask;

    y = y * (1.0 - walkwayCoreMask) + walkwayY * walkwayCoreMask;

    const edgeFlatten = 1.0 - walkwayEdgeMask * 0.9;
    const edgeY =
      base * edgeFlatten * sideMul + valley - riverMask * p.riverDepth * 0.25;

    y = y * (1.0 - walkwayEdgeMask) + (edgeY + p.walkwayLift) * walkwayEdgeMask;

    return { y, masks: { riverMask, walkwayMask: walkwayRingMask } };
  }

  return { sample, params: p };
}
