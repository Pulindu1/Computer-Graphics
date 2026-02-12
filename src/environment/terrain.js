import * as THREE from "three";
import { createTerrainSampler } from "./terrainHeight.js";

// Simple 2D smoothing (box blur) on the height grid.
// iterations: 2–6 is usually enough
function smoothHeights(heights, protectMask, w, h, iterations = 4, strength = 0.55) {
  const tmp = new Float32Array(heights.length);

  for (let it = 0; it < iterations; it++) {
    tmp.set(heights);

    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < w - 1; i++) {
        const idx = j * w + i;

        // Protect river + walkway cores from smoothing
        if (protectMask && protectMask[idx] > 0.65) continue;

        let sum = 0;
        sum += tmp[idx];
        sum += tmp[idx - 1];
        sum += tmp[idx + 1];
        sum += tmp[idx - w];
        sum += tmp[idx + w];
        sum += tmp[idx - w - 1];
        sum += tmp[idx - w + 1];
        sum += tmp[idx + w - 1];
        sum += tmp[idx + w + 1];

        const avg = sum / 9;
        heights[idx] = tmp[idx] * (1 - strength) + avg * strength;
      }
    }
  }
}


export function createTerrain({
  width = 800,
  length = 800,
  segmentsWidth = 300,
  segmentsLength = 300,
  samplerParams = {},
  smoothing = { iterations: 5, strength: 0.6 } // tweak here
} = {}) {
  const { sample } = createTerrainSampler(samplerParams);

  const geo = new THREE.PlaneGeometry(width, length, segmentsWidth, segmentsLength);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;

  // PlaneGeometry with segments N has (N+1) vertices per side
  const vertsWidth = segmentsWidth + 1;
  const vertsLength = segmentsLength + 1;
  const totalVerts = vertsWidth * vertsLength;

  // Build height grid + masks grid (for colouring)
  const heights = new Float32Array(totalVerts);
  const riverMaskGrid = new Float32Array(totalVerts);
  const walkwayMaskGrid = new Float32Array(totalVerts);



  // Important: PlaneGeometry vertex order is row-major
  for (let idx = 0; idx < totalVerts; idx++) {
    const x = pos.getX(idx);
    const z = pos.getZ(idx);

    const { y, masks } = sample(x, z);

    heights[idx] = y;
    riverMaskGrid[idx] = masks?.riverMask ?? 0;
    walkwayMaskGrid[idx] = masks?.walkwayMask ?? 0;
  }
  const protectMask = new Float32Array(totalVerts);
  for (let i = 0; i < totalVerts; i++) {
    protectMask[i] = Math.max(riverMaskGrid[i], walkwayMaskGrid[i]);
  }


  // Smooth ONLY the heights (masks stay sharp-ish for colouring)
  smoothHeights(
  heights,
  protectMask,
  vertsWidth,
  vertsLength,
  smoothing.iterations,
  smoothing.strength
);


  // Apply smoothed heights + vertex colours
  const colors = new Float32Array(totalVerts * 3);
  const c = new THREE.Color();

  const grassA = new THREE.Color(0x2f7d32);
  const grassB = new THREE.Color(0x3f9440);
  const walkway = new THREE.Color(0x7a7a7a);
  const river = new THREE.Color(0x2a5f9e);

  for (let idx = 0; idx < totalVerts; idx++) {
    const x = pos.getX(idx);
    const z = pos.getZ(idx);

    pos.setY(idx, heights[idx]);

    // grass variation
    const t = (Math.sin((x + z) * 0.015) * 0.5 + 0.5);
    c.copy(grassA).lerp(grassB, t * 0.35);

    // smooth colour blend using masks (from sampler)
    const wMask = walkwayMaskGrid[idx];
    const rMask = riverMaskGrid[idx];

    c.lerp(walkway, wMask);
    c.lerp(river, rMask);

    colors[idx * 3 + 0] = c.r;
    colors[idx * 3 + 1] = c.g;
    colors[idx * 3 + 2] = c.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "Terrain";

  // IMPORTANT: heightAt should match the *smoothed* surface, not the raw sampler.
  // We’ll sample from the height grid using bilinear interpolation.
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const stepWidth = width / segmentsWidth;
  const stepLength = length / segmentsLength;

  function heightAt(x, z) {
    // convert world x,z to grid coords (0..segments)
    const fx = (x + halfWidth) / stepWidth;
    const fz = (z + halfLength) / stepLength;

    // clamp inside grid
    const x0 = Math.max(0, Math.min(segmentsWidth - 1, Math.floor(fx)));
    const z0 = Math.max(0, Math.min(segmentsLength - 1, Math.floor(fz)));

    const tx = fx - x0;
    const tz = fz - z0;

    const i00 = z0 * vertsWidth + x0;
    const i10 = z0 * vertsWidth + (x0 + 1);
    const i01 = (z0 + 1) * vertsWidth + x0;
    const i11 = (z0 + 1) * vertsWidth + (x0 + 1);

    const h00 = heights[i00];
    const h10 = heights[i10];
    const h01 = heights[i01];
    const h11 = heights[i11];

    // bilinear interpolation
    const hx0 = h00 * (1 - tx) + h10 * tx;
    const hx1 = h01 * (1 - tx) + h11 * tx;
    return hx0 * (1 - tz) + hx1 * tz;
  }

  function masksAt(x, z) {
    // if you need this later, you can also interpolate masks similarly
    return sample(x, z).masks;
  }

  return { mesh, heightAt, masksAt };
}
