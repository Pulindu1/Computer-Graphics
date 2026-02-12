// import * as THREE from "three";

// /**
//  * Water ribbon that follows the same meandering river centreline as terrainHeight.js,
//  * using UV scrolling for motion (cheap + stable).
//  *
//  * No external textures: we generate a simple CanvasTexture and scroll it.
//  */

// // Must match the meander equation used in terrainHeight.js
// function riverCenterX(z, p) {
//   return (
//     Math.sin((z + p.seedishOffset) / p.riverMeanderWavelength) *
//       p.riverMeanderAmp +
//     Math.sin((z - p.seedishOffset) / (p.riverMeanderWavelength * 0.55)) *
//       (p.riverMeanderAmp * 0.35)
//   );
// }

// // Simple procedural water texture (blue-ish streaks + noise-ish lines)
// function makeWaterTextureCanvas(size = 256) {
//   const canvas = document.createElement("canvas");
//   canvas.width = size;
//   canvas.height = size;
//   const ctx = canvas.getContext("2d");

//   // Base
//   ctx.fillStyle = "#1b4f8a";
//   ctx.fillRect(0, 0, size, size);

//   // Soft gradient
//   const grad = ctx.createLinearGradient(0, 0, size, size);
//   grad.addColorStop(0, "rgba(255,255,255,0.06)");
//   grad.addColorStop(1, "rgba(0,0,0,0.10)");
//   ctx.fillStyle = grad;
//   ctx.fillRect(0, 0, size, size);

//   // Streaks (simulate flow)
//   for (let i = 0; i < 40; i++) {
//     const y = Math.random() * size;
//     const thickness = 1 + Math.random() * 2.5;
//     const alpha = 0.05 + Math.random() * 0.07;

//     ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
//     ctx.lineWidth = thickness;
//     ctx.beginPath();

//     const x0 = -20;
//     const x1 = size + 20;
//     const wobble = 6 + Math.random() * 10;

//     ctx.moveTo(x0, y);
//     ctx.bezierCurveTo(
//       size * 0.33,
//       y + (Math.random() - 0.5) * wobble,
//       size * 0.66,
//       y + (Math.random() - 0.5) * wobble,
//       x1,
//       y + (Math.random() - 0.5) * wobble,
//     );
//     ctx.stroke();
//   }

//   return canvas;
// }

// export function createWater({
//   // must match your terrain dimensions
//   width = 800,
//   length = 800,
//   waterLevel = -6,

//   // river shape params (should match terrainHeight.js params)
//   samplerParams = {},

//   // how wide the visible water is (defaults to terrain's riverHalfWidth)
//   waterHalfWidth = null,

//   // how high above the carved river bed to place the surface
//   yOffset = 0.35,

//   // geometry detail
//   segmentsLength = 260,
//   segmentsWidth = 6,

//   // UV scroll speed
//   flowSpeed = 0.04,
// } = {}) {
//   // Merge defaults matching your terrainHeight.js
//   const p = {
//     riverMeanderAmp: 55,
//     riverMeanderWavelength: 140,
//     riverHalfWidth: 56,
//     seedishOffset: 13.37,
//     ...samplerParams,
//   };

//   const halfW = width / 2;
//   const halfL = length / 2;

//   const halfWidth =
//     waterHalfWidth !== null ? waterHalfWidth : p.riverHalfWidth * 0.92;
//   const ribbonWidth = halfWidth * 2;

//   // Build a ribbon plane aligned along Z
//   const geo = new THREE.PlaneGeometry(
//     ribbonWidth,
//     length,
//     segmentsWidth,
//     segmentsLength,
//   );
//   geo.rotateX(-Math.PI / 2);

//   const pos = geo.attributes.position;

//   // Bend the ribbon to follow the river centreline
//   // For each vertex: compute its z, find river centre x at that z, then offset by local x
//   for (let i = 0; i < pos.count; i++) {
//     const localX = pos.getX(i);
//     const z = pos.getZ(i);

//     const centerX = riverCenterX(z, p);
//     const x = centerX + localX;

//     pos.setX(i, x);
//   }
//   pos.needsUpdate = true;
//   geo.computeVertexNormals();

//   // Texture (procedural canvas)
//   const canvas = makeWaterTextureCanvas(256);
//   const tex = new THREE.CanvasTexture(canvas);
//   tex.wrapS = THREE.RepeatWrapping;
//   tex.wrapT = THREE.RepeatWrapping;
//   tex.repeat.set(2, 14); // more repeats = finer streaks
//   tex.offset.set(0, 0);

//   const mat = new THREE.MeshStandardMaterial({
//     map: tex,
//     color: 0x2a5f9e,
//     roughness: 0.25,
//     metalness: 0.0,
//     transparent: true,
//     opacity: 0.30,
//     depthWrite: false, // helps avoid z-fighting with terrain
//   });

//   const mesh = new THREE.Mesh(geo, mat);
//   mesh.name = "Water";

//   // Place it slightly above terrain base; we’ll set y in update() using terrain height if supplied
//   mesh.position.y = waterLevel + yOffset;

 
//   function update(dt) {
//     tex.offset.x = (tex.offset.x + dt * flowSpeed) % 1;
// }



//   return { mesh, update };
// }



import * as THREE from "three";

/**
 * Still (non-animated) water ribbon that follows the same meandering river centreline
 * as terrainHeight.js. Uses a semi-shiny, semi-transparent Physical material.
 *
 * No texture scrolling / no ripples for now.
 */

// Must match the meander equation used in terrainHeight.js
function riverCenterX(z, p) {
  return (
    Math.sin((z + p.seedishOffset) / p.riverMeanderWavelength) *
      p.riverMeanderAmp +
    Math.sin((z - p.seedishOffset) / (p.riverMeanderWavelength * 0.55)) *
      (p.riverMeanderAmp * 0.35)
  );
}

export function createWater({
  // must match your terrain dimensions
  width = 800,
  length = 800,

  // constant river surface level (should match terrainHeight.js waterLevel)
  waterLevel = -6,

  // river shape params (should match terrainHeight.js params)
  samplerParams = {},

  // how wide the visible water is (defaults to terrain's riverHalfWidth)
  waterHalfWidth = null,

  // how high above the carved river surface to place the mesh (avoid z-fighting)
  yOffset = 0.35,

  // geometry detail
  segmentsLength = 260,
  segmentsWidth = 6,

  // material tuning
  color = 0x2a5f9e,
  opacity = 0.38,
  roughness = 0.08,
  clearcoat = 1.0,
  clearcoatRoughness = 0.06,
  transmission = 0.0, // keep 0 for stability; can try 0.1–0.2 later
  thickness = 0.8
} = {}) {
  // Merge defaults matching your terrainHeight.js
  const p = {
    riverMeanderAmp: 55,
    riverMeanderWavelength: 140,
    riverHalfWidth: 56,
    seedishOffset: 13.37,
    ...samplerParams
  };

  const halfWidth =
    waterHalfWidth !== null ? waterHalfWidth : p.riverHalfWidth * 0.92;
  const ribbonWidth = halfWidth * 2;

  // Build a ribbon plane aligned along Z
  const geo = new THREE.PlaneGeometry(
    ribbonWidth,
    length,
    segmentsWidth,
    segmentsLength
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;

  // Bend the ribbon to follow the river centreline
  // For each vertex: compute its z, find river centre x at that z, then offset by local x
  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const z = pos.getZ(i);

    const centerX = riverCenterX(z, p);
    pos.setX(i, centerX + localX);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Still water material
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,

    // watery sheen
    roughness,
    metalness: 0.0,
    clearcoat,
    clearcoatRoughness,

    // optional glass-like effect (leave 0 for now)
    transmission,
    thickness,

    depthWrite: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "Water";

  // Flat horizontal water surface
  mesh.position.y = waterLevel + yOffset;

  function update(_dt) {
    // still water for now
  }

  return { mesh, update };
}