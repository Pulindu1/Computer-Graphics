// Terrain flattening + blending helpers for procedural street district
// Provides distance-to-footprint and blend weight calculations

import * as THREE from "three";

// Smooth blending function (same as in terrainHeight.js)
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Compute signed distance from point to rectangle (axis-aligned for simplicity)
// Rectangle: centerX, centerZ, halfWidth, halfLength
export function distanceToRectangle(x, z, centerX, centerZ, halfW, halfL) {
  const dx = Math.abs(x - centerX) - halfW;
  const dz = Math.abs(z - centerZ) - halfL;
  const outsideX = Math.max(0, dx);
  const outsideZ = Math.max(0, dz);
  return Math.sqrt(outsideX * outsideX + outsideZ * outsideZ);
}

// Blend weight for smoothly transitioning from original to flattened terrain
// Returns: 0 inside street (fully flat), 1 outside shoulder (fully original), smooth blend in between
export function getStreetBlendWeight(dist, streetInnerRadius = 0, shoulderWidth = 40) {
  // 0..innerRadius: blend = 0 (fully flat)
  // innerRadius..outerRadius: smooth transition
  // outerRadius+: blend = 1 (fully original)
  return smoothstep(streetInnerRadius, streetInnerRadius + shoulderWidth, dist);
}

// Apply street flattening to terrain geometry vertices
// Modifies geometry in-place
// terrainData: { heights, vertsWidth, vertsLength, width, length, segmentsWidth, segmentsLength }
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

  // Get terrain dimensions
  const { heights, vertsWidth, vertsLength, width = 800, length = 800, segmentsWidth = 200, segmentsLength = 50 } = terrainData;
  const halfTerrainWidth = width / 2;
  const halfTerrainLength = length / 2;
  const stepWidth = width / segmentsWidth;
  const stepLength = length / segmentsLength;

  // Modify terrain height grid directly
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];

    // Compute vertex index in height grid
    const fx = (x + halfTerrainWidth) / stepWidth;
    const fz = (z + halfTerrainLength) / stepLength;
    const vertIdx = Math.floor(fz) * vertsWidth + Math.floor(fx);

    if (vertIdx >= 0 && vertIdx < heights.length) {
      // Compute distance to street footprint
      const dist = distanceToRectangle(x, z, centerX, centerZ, halfWidth, halfLength);

      // Compute blend weight
      const blendW = getStreetBlendWeight(dist, 0, shoulderWidth);

      // Interpolate: inside street (blendW=0) -> streetHeight, outside (blendW=1) -> original height
      const originalHeight = heights[vertIdx];
      const finalHeight = streetHeight * (1 - blendW) + originalHeight * blendW;

      // Update both height grid and geometry position
      heights[vertIdx] = finalHeight;
      positions[i + 1] = finalHeight;
    }
  }

  pos.needsUpdate = true;
  if (geometry.boundingBox) geometry.computeBoundingBox();
  if (geometry.boundingSphere) geometry.computeBoundingSphere();
}

// Compute positions for plots along street sides
// Returns array of {pos: Vector3, rotY: number, seed: number, side: 'left' | 'right'}
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

  // Number of plots that fit along street length
  const plotCount = Math.floor((halfLength * 2) / (plotWidth + plotGap));

  const zStart = centerZ - halfLength;

  for (let i = 0; i < plotCount; i++) {
    const localZ = (i + 0.5) * (plotWidth + plotGap) - halfLength;
    const worldZ = centerZ + localZ;

    // Right side only (positive X)
    plots.push({
      pos: new THREE.Vector3(
        centerX + halfWidth * 0.6,  // Closer to middle of platform
        0, // Will be set by house factory using terrain height
        worldZ
      ),
      rotY: Math.PI, // Face toward street
      seed: i,
      side: "right",
    });
  }

  return plots;
}
