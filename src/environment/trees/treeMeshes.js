/**
 * treeMeshes.js
 * Tree geometry, materials, instance-matrix helpers.
 *
 * Two material tiers:
 *  - buildTreeMaterials()       – full quality, optional GPU wind shader
 *  - buildSimpleTreeMaterials() – cheap (no wind), used for mid/far LOD
 *
 * Wind technique:
 *  Standard MeshStandardMaterial + onBeforeCompile patch.
 *  A per-instance world-space origin is derived from the instanceMatrix
 *  attribute to give each tree a unique wind phase → spatially coherent sway.
 *  Only ONE uniform (uWindTime) is updated per frame — zero CPU matrix work.
 */

import * as THREE from "three";

// ─────────────────────────────────────────────────────────────
//  Materials
// ─────────────────────────────────────────────────────────────

/**
 * Build trunk + leaves materials.
 * If windEnabled, the leaves material gets a vertex shader patch
 * that bends the top of each cone in a sinusoidal sway.
 *
 * @returns {{ trunk, leaves, leavesUniforms }}
 *   leavesUniforms is null when windEnabled=false.
 */
export function buildTreeMaterials({ windEnabled = true } = {}) {
  const trunk = new THREE.MeshStandardMaterial({
    color:     0x5c3d1e,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Shared uniform objects so the main loop can update uWindTime.value
  // without triggering material recompile.
  const leavesUniforms = {
    uWindTime:     { value: 0.0 },
    uWindStrength: { value: windEnabled ? 0.8 : 0.0 },
    uWindSpeed:    { value: 1.2 },
  };

  const leaves = new THREE.MeshStandardMaterial({
    color:     0x2d6a2d,
    roughness: 0.85,
    metalness: 0.0,
    side:      THREE.FrontSide,
  });

  if (windEnabled) {
    // Unique cache key so this compiled program isn't confused with
    // unpatched standard materials.
    leaves.customProgramCacheKey = () => 'tree-wind-leaves-v1';

    leaves.onBeforeCompile = (shader) => {
      // 1. Inject uniform declarations at the top of the vertex shader.
      shader.uniforms.uWindTime     = leavesUniforms.uWindTime;
      shader.uniforms.uWindStrength = leavesUniforms.uWindStrength;
      shader.uniforms.uWindSpeed    = leavesUniforms.uWindSpeed;

      shader.vertexShader =
        `uniform float uWindTime;\n` +
        `uniform float uWindStrength;\n` +
        `uniform float uWindSpeed;\n` +
        shader.vertexShader;

      // 2. After the standard `vec3 transformed = vec3(position)` line,
      //    displace x/z by a sinusoidal wave.
      //    The instance's world-space origin (instanceMatrix * origin) is used
      //    as a spatial phase offset so adjacent trees sway together while
      //    distant trees are out of phase — looks like a real wind gust.
      shader.vertexShader = shader.vertexShader.replace(
        /#include <begin_vertex>/,
        `#include <begin_vertex>
// ── GPU wind sway ────────────────────────────────────────────
// Compute world-space origin of this instance for phase offset.
#ifdef USE_INSTANCING
  vec4 _instOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
  vec4 _instOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#endif
float _windPhase  = _instOrigin.x * 0.07 + _instOrigin.z * 0.05;
// Height factor: top of cone (local y ≈ leafHeight/2) sways most, base stays fixed.
float _windFactor = clamp(position.y / 3.5, 0.0, 1.0);
float _sway1 = sin(uWindTime * uWindSpeed + _windPhase) * uWindStrength;
float _sway2 = cos(uWindTime * uWindSpeed * 0.7 + _windPhase * 1.3) * uWindStrength * 0.35;
transformed.x += _sway1 * _windFactor;
transformed.z += _sway2 * _windFactor;
// ─────────────────────────────────────────────────────────────
`
      );
    };
  }

  return { trunk, leaves, leavesUniforms: windEnabled ? leavesUniforms : null };
}

/**
 * Simple (no-wind) materials for mid/far LOD tiers.
 * Slightly darker green to distinguish far trees from near trees.
 */
export function buildSimpleTreeMaterials() {
  return {
    trunk:          new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.9 }),
    leaves:         new THREE.MeshStandardMaterial({ color: 0x276127, roughness: 0.9 }),
    leavesUniforms: null,
  };
}

// ─────────────────────────────────────────────────────────────
//  Instanced mesh factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a trunk + leaves InstancedMesh pair with specified geometry quality.
 *
 * @param {object} cfg
 *   trunkSegs    – radial segments for trunk cylinder
 *   leafSegs     – radial segments for leaf cone
 *   trunkRadius  – [topR, bottomR]
 *   trunkHeight  – cylinder height
 *   leafRadius   – cone base radius
 *   leafHeight   – cone height
 *   maxCount     – maximum instance count
 *   materials    – { trunk, leaves }
 *   dynamic      – use DynamicDrawUsage (true for LOD tiers updated per 0.25s)
 */
export function createTreeMeshPair({
  trunkSegs   = 7,
  leafSegs    = 8,
  trunkRadius = [0.25, 0.42],
  trunkHeight = 4.0,
  leafRadius  = 1.6,
  leafHeight  = 4.2,
  maxCount,
  materials,
  dynamic     = false,
}) {
  const usage = dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;

  const trunkGeo = new THREE.CylinderGeometry(
    trunkRadius[0], trunkRadius[1], trunkHeight, trunkSegs, 1
  );
  const leafGeo = new THREE.ConeGeometry(leafRadius, leafHeight, leafSegs, 2);

  const trunkMesh  = new THREE.InstancedMesh(trunkGeo, materials.trunk,  maxCount);
  const leavesMesh = new THREE.InstancedMesh(leafGeo,  materials.leaves, maxCount);

  trunkMesh.castShadow    = true;
  trunkMesh.receiveShadow = true;
  leavesMesh.castShadow   = true;
  leavesMesh.receiveShadow = false; // Leaves don't need expensive self-shadow

  trunkMesh.instanceMatrix.setUsage(usage);
  leavesMesh.instanceMatrix.setUsage(usage);

  // Start with 0 visible instances
  trunkMesh.count  = 0;
  leavesMesh.count = 0;

  return { trunk: trunkMesh, leaves: leavesMesh };
}

/**
 * Create a small, simpler tree mesh pair (for 10% of trees).
 * Two spheres stacked together for foliage, doubled in size.
 * Scales: trunk ~5.6 units, leaves as 2 stacked spheres (2x the original size).
 */
export function createSmallTreeMeshPair({
  maxCount,
  materials,
  dynamic = false,
}) {
  const usage = dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;

  // Doubled trunk geometry
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 5.6, 4, 1);
  
  // Two stacked spheres for a lollipop tree shape
  const leafGeo = createTwoSphereCombined();

  const trunkMesh  = new THREE.InstancedMesh(trunkGeo, materials.trunk,  maxCount);
  const leavesMesh = new THREE.InstancedMesh(leafGeo,  materials.leaves, maxCount);

  trunkMesh.castShadow    = true;
  trunkMesh.receiveShadow = true;
  leavesMesh.castShadow   = true;
  leavesMesh.receiveShadow = false;

  trunkMesh.instanceMatrix.setUsage(usage);
  leavesMesh.instanceMatrix.setUsage(usage);

  trunkMesh.count  = 0;
  leavesMesh.count = 0;

  return { trunk: trunkMesh, leaves: leavesMesh };
}

/**
 * Create a combined geometry of two stacked spheres.
 * Returns a BufferGeometry that looks like two overlapping spheres.
 */
function createTwoSphereCombined() {
  const sphere1 = new THREE.SphereGeometry(0.75, 8, 6);
  const sphere2 = new THREE.SphereGeometry(0.75, 8, 6);
  
  // Position first sphere lower
  sphere1.translate(0, -0.5, 0);
  // Position second sphere higher
  sphere2.translate(0, 0.5, 0);
  
  // Merge geometries
  const combined = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const indices = [];
  let vertexOffset = 0;
  
  // Add sphere 1
  const pos1 = sphere1.getAttribute('position').array;
  const norm1 = sphere1.getAttribute('normal').array;
  const idx1 = sphere1.getIndex().array;
  
  for (let i = 0; i < pos1.length; i++) {
    positions.push(pos1[i]);
    normals.push(norm1[i]);
  }
  for (let i = 0; i < idx1.length; i++) {
    indices.push(idx1[i] + vertexOffset);
  }
  vertexOffset += pos1.length / 3;
  
  // Add sphere 2
  const pos2 = sphere2.getAttribute('position').array;
  const norm2 = sphere2.getAttribute('normal').array;
  const idx2 = sphere2.getIndex().array;
  
  for (let i = 0; i < pos2.length; i++) {
    positions.push(pos2[i]);
    normals.push(norm2[i]);
  }
  for (let i = 0; i < idx2.length; i++) {
    indices.push(idx2[i] + vertexOffset);
  }
  
  combined.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  combined.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  combined.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  
  return combined;
}

/**
 * Filter instances by type and extract their indices.
 */
export function getInstancesOfType(instances, type) {
  const indices = [];
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].type === type) indices.push(i);
  }
  return indices;
}

/**
 * Write instance matrices for a SUBSET of instances (identified by indices).
 * Used by TreeLodBuckets when redistributing tiers.
 */
export function applyInstancesSubset(instances, indices, pair) {
  const n = indices.length;
  pair.trunk.count  = n;
  pair.leaves.count = n;

  for (let i = 0; i < n; i++) {
    _writeTrunkMatrix(instances[indices[i]], i, pair.trunk);
    _writeLeavesMatrix(instances[indices[i]], i, pair.leaves);
  }

  pair.trunk.instanceMatrix.needsUpdate  = true;
  pair.trunk.instanceMatrix.needsUpdate  = true;
  pair.leaves.instanceMatrix.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────
//  Helper functions for matrix writes
// ─────────────────────────────────────────────────────────────

// Single shared dummy Object3D avoids per-call allocation (JS is single-threaded)
const _dummy = new THREE.Object3D();

function _writeTrunkMatrix(t, slot, mesh) {
  // Trunk centred at half its height above ground
  _dummy.position.set(t.x, t.y + 2.0 * t.scale, t.z);
  _dummy.rotation.set(0, t.rotY, 0);
  _dummy.scale.setScalar(t.scale);
  _dummy.updateMatrix();
  mesh.setMatrixAt(slot, _dummy.matrix);
}

function _writeLeavesMatrix(t, slot, mesh) {
  // Cone origin is at its base; offset up so base sits atop trunk top
  _dummy.position.set(t.x, t.y + 5.2 * t.scale, t.z);
  _dummy.rotation.set(0, t.rotY, 0);
  _dummy.scale.setScalar(t.scale);
  _dummy.updateMatrix();
  mesh.setMatrixAt(slot, _dummy.matrix);
}
