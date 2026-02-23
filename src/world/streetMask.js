import * as THREE from "three";


function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function distanceToRectangle(x, z, centerX, centerZ, halfW, halfL) {
  const dx = Math.abs(x - centerX) - halfW;
  const dz = Math.abs(z - centerZ) - halfL;
  const outsideX = Math.max(0, dx);
  const outsideZ = Math.max(0, dz);
  return Math.sqrt(outsideX * outsideX + outsideZ * outsideZ);
}


export function getStreetBlendWeight(dist, streetInnerRadius = 0, shoulderWidth = 40) {
  return smoothstep(streetInnerRadius, streetInnerRadius + shoulderWidth, dist);
}


export function applyStreetFlattenToTerrain(geometry, terrainData, streetConfig) {
  if (!geometry.attributes.position) return;

  const pos = geometry.attributes.position;
  const positions = pos.array;

  const centerX = streetConfig.centerX;
  const centerZ = streetConfig.centerZ;
  const halfWidth = streetConfig.halfWidth;
  const halfLength = streetConfig.halfLength;
  const shoulderWidth = streetConfig.shoulderWidth || 40;
  const streetHeight = streetConfig.streetHeight;

  const { heights, vertsWidth, vertsLength, width = 800, length = 800, segmentsWidth = 200, segmentsLength = 50 } = terrainData;
  const halfTerrainWidth = width / 2;
  const halfTerrainLength = length / 2;
  const stepWidth = width / segmentsWidth;
  const stepLength = length / segmentsLength;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const fx = (x + halfTerrainWidth) / stepWidth;
    const fz = (z + halfTerrainLength) / stepLength;
    const vertIdx = Math.floor(fz) * vertsWidth + Math.floor(fx);

    if (vertIdx >= 0 && vertIdx < heights.length) {
      const dist = distanceToRectangle(x, z, centerX, centerZ, halfWidth, halfLength);

      const blendW = getStreetBlendWeight(dist, 0, shoulderWidth);

      
      const originalHeight = heights[vertIdx];
      const finalHeight = streetHeight * (1 - blendW) + originalHeight * blendW;

      heights[vertIdx] = finalHeight;
      positions[i + 1] = finalHeight;
    }
  }

  pos.needsUpdate = true;
  if (geometry.boundingBox) geometry.computeBoundingBox();
  if (geometry.boundingSphere) geometry.computeBoundingSphere();
}


export function computePlots(streetConfig, houseConfig) {
  const plots = [];
  const centerX = streetConfig.centerX;
  const centerZ = streetConfig.centerZ;
  const halfLength = streetConfig.halfLength;
  const halfWidth = streetConfig.halfWidth;

  const plotWidth = houseConfig.plotWidth;
  const plotGap = houseConfig.plotGap;
  const setback = houseConfig.setback;
  const plotDepth = houseConfig.plotDepth;


  const plotCount = Math.floor((halfLength * 2) / (plotWidth + plotGap));

  const zStart = centerZ - halfLength;

  for (let i = 0; i < plotCount; i++) {
    const localZ = (i + 0.5) * (plotWidth + plotGap) - halfLength;
    const worldZ = centerZ + localZ;

    plots.push({
      pos: new THREE.Vector3(
        centerX + halfWidth * 0.6,
        0,
        worldZ
      ),
      rotY: Math.PI,
      seed: i,
      side: "right",
    });
  }

  return plots;
}
