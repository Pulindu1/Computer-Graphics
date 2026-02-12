// Pure terrain math: x,z -> { y, masks }
// masks are smooth weights in [0..1] used for colouring and logic later.

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
    // Base terrain undulation (keep smooth)
    baseAmplitude: 12,
    baseWavelength: 220,
    secondaryAmplitude: 4,
    secondaryWavelength: 110,

    // River: windier
    riverMeanderAmp: 55,
    riverMeanderWavelength: 140,

    // River cross-section
    riverHalfWidth: 56,
    riverBlend: 16,
    riverDepth: 14,
    waterLevel: -6,  // <-- NEW: constant river water surface height


    // Walkway band (either side of river)
    walkwayWidth: 32,
    walkwayBlend: 20,    // Increased from 5 for smoother transitions
    walkwayLift: 0.3,    // Reduced from 0.9 for flatter path

    // Hills shaping (asymmetry)
    leftHillMultiplier: 1.1,
    rightHillMultiplier: 1.65,

    // NEW: valleyMaxHeight is now a *bounded* height (not a slope coefficient)
    valleyMaxHeight: 180, // try 140..260 for steeper/less steep
    floodplainWidth: 30,  // flat-ish zone near river
    rampWidth: 240,       // how far from floodplain until hills reach max

    // How sharply hills rise after floodplain (higher = steeper)
    rampPower: 2.6,       // try 2.0..3.4

    seedishOffset: 13.37,

    ...params,
  };

  function sample(x, z) {
    const cx = riverCenterX(z, p);
    const d = Math.abs(x - cx);

    // Smooth base height (low-ish frequency)
    const base =
      Math.sin((x + p.seedishOffset) / p.baseWavelength) * p.baseAmplitude +
      Math.cos((z - p.seedishOffset) / (p.baseWavelength * 0.95)) * (p.baseAmplitude * 0.55) +
      Math.sin((x + z) / p.secondaryWavelength) * p.secondaryAmplitude;

    // Asymmetry: right side hillier
    const sideMul = x < cx ? p.leftHillMultiplier : p.rightHillMultiplier;

    // --- Valley profile (bounded, "flat then steep") ---
    // 1) subtract floodplain
    const rampD = Math.max(0, d - p.floodplainWidth);
    // 2) convert to 0..1 using smoothstep so it never explodes
    const tRamp = smoothstep(0, p.rampWidth, rampD);
    // 3) make it steeper
    const steepRamp = Math.pow(tRamp, p.rampPower);
    // 4) asymmetry of valley rise
    const slopeMul = x < cx ? 0.85 : 1.25;

    const valley = steepRamp * p.valleyMaxHeight * slopeMul;

    // Smooth "river mask": 1 at centre, fades to 0 outside (halfWidth+blend)
    const riverInner = p.riverHalfWidth;
    const riverOuter = p.riverHalfWidth + p.riverBlend;
    const riverMask = 1.0 - smoothstep(riverInner, riverOuter, d);

    // Smooth "walkway ring mask" just outside the river
    const wIn = p.riverHalfWidth;
    const wOut = p.riverHalfWidth + p.walkwayWidth;

    const walkwayRingMask =
      smoothstep(wIn, wIn + p.walkwayBlend, d) *
      (1.0 - smoothstep(wOut, wOut + p.walkwayBlend, d));

    // Start with terrain (land height)
    let y = base * sideMul + valley;

    // --- River: force a flat water surface at waterLevel ---
    // We blend the land height toward a constant water level using riverMask.
    // riverMask = 1 at centre -> y becomes waterLevel
    // riverMask -> 0 away from river -> y stays as land
    y = y * (1.0 - riverMask) + p.waterLevel * riverMask;


    // --- Walkway: flat core, blend at edges ---

    const walkwayY = p.waterLevel + p.walkwayLift;


    const walkwayCoreMask = Math.pow(walkwayRingMask, 1.2);  // Reduced from 1.8 for smoother core
    const walkwayEdgeMask = walkwayRingMask - walkwayCoreMask;

    // Core: snap to flat
    y = y * (1.0 - walkwayCoreMask) + walkwayY * walkwayCoreMask;

    // Edge: gentle transition
    const edgeFlatten = 1.0 - walkwayEdgeMask * 0.9;
    const edgeY =
      base * edgeFlatten * sideMul + valley - riverMask * p.riverDepth * 0.25;

    y = y * (1.0 - walkwayEdgeMask) + (edgeY + p.walkwayLift) * walkwayEdgeMask;

    return { y, masks: { riverMask, walkwayMask: walkwayRingMask } };
  }

  return { sample, params: p };
}
