/**
 * treeLodBuckets.js
 * Three-tier instanced LOD for the tree system.
 *
 * Tiers:
 *  NEAR  (d < 80m) – full quality, 7-seg trunk + 8-seg cone + wind shader
 *  MID  (80–180m) – medium, 5-seg trunk + 6-seg cone, no wind
 *  FAR  (> 180m)  – minimal, 4-seg trunk + 4-seg cone, no wind
 *
 * Hysteresis thresholds prevent LOD pop-in:
 *  Enter NEAR at 80m, exit NEAR at 95m
 *  Enter FAR  at 185m, exit FAR at 170m
 *
 * Redistribution is run every REBUILD_INTERVAL seconds (default 0.25s),
 * not every frame — keeping cost O(N) per quarter-second, not per frame.
 *
 * Uses squared-distance comparisons throughout to avoid per-tree sqrt.
 */

import { buildSimpleTreeMaterials, createTreeMeshPair, applyInstancesSubset } from "./treeMeshes.js";

// ── LOD tier constants ───────────────────────────────────────
const TIER_NEAR = 0;
const TIER_MID  = 1;
const TIER_FAR  = 2;

// Squared distance thresholds (avoids sqrt per tree per redistribution)
const NEAR_ENTER_D2 =  80 *  80;   // d < 80m  → enter NEAR
const NEAR_EXIT_D2  =  95 *  95;   // d > 95m  → leave NEAR (hysteresis gap = 15m)
const FAR_ENTER_D2  = 185 * 185;   // d > 185m → enter FAR
const FAR_EXIT_D2   = 170 * 170;   // d < 170m → leave FAR  (hysteresis gap = 15m)

export class TreeLodBuckets {
  /**
   * @param {THREE.Scene} scene
   * @param {object} nearMats   – full-quality materials (from buildTreeMaterials, may have wind)
   * @param {Array}  instances  – placement array from generateTreeInstances
   * @param {Array}  indices    – optional: indices to filter instances (for sub-type filtering)
   */
  constructor(scene, nearMats, instances, indices = null) {
    this.scene     = scene;
    this.instances = instances;
    this.indices   = indices;  // if null, use all instances; else use only instances[indices[i]]
    const n = indices ? indices.length : instances.length;

    // Mid + far tiers share one cheap material set (no wind shader compile overhead)
    const simpleMats = buildSimpleTreeMaterials();

    // ── NEAR: full quality, dynamic (redistributed every 0.25s) ──
    this.nearPair = createTreeMeshPair({
      trunkSegs: 7, leafSegs: 8,
      trunkRadius: [0.25, 0.42], trunkHeight: 4.0,
      leafRadius: 1.6, leafHeight: 4.2,
      maxCount: n, materials: nearMats, dynamic: true,
    });

    // ── MID: medium quality ──────────────────────────────────────
    this.midPair = createTreeMeshPair({
      trunkSegs: 5, leafSegs: 6,
      trunkRadius: [0.22, 0.38], trunkHeight: 4.0,
      leafRadius: 1.5, leafHeight: 4.0,
      maxCount: n, materials: simpleMats, dynamic: true,
    });

    // ── FAR: minimal quality ─────────────────────────────────────
    this.farPair = createTreeMeshPair({
      trunkSegs: 4, leafSegs: 4,
      trunkRadius: [0.20, 0.35], trunkHeight: 3.8,
      leafRadius: 1.4, leafHeight: 3.8,
      maxCount: n, materials: simpleMats, dynamic: true,
    });

    // Name meshes for inspector readability
    this.nearPair.trunk.name   = 'TreeTrunk_Near';
    this.nearPair.leaves.name  = 'TreeLeaves_Near';
    this.midPair.trunk.name    = 'TreeTrunk_Mid';
    this.midPair.leaves.name   = 'TreeLeaves_Mid';
    this.farPair.trunk.name    = 'TreeTrunk_Far';
    this.farPair.leaves.name   = 'TreeLeaves_Far';

    scene.add(this.nearPair.trunk,  this.nearPair.leaves);
    scene.add(this.midPair.trunk,   this.midPair.leaves);
    scene.add(this.farPair.trunk,   this.farPair.leaves);

    // Per-instance hysteresis state: start everyone in MID tier
    this._tier  = new Uint8Array(n).fill(TIER_MID);

    // Reusable index arrays — pre-allocated, no per-frame array creation
    this._nearIdx = new Int32Array(n);
    this._midIdx  = new Int32Array(n);
    this._farIdx  = new Int32Array(n);
    this._nearN   = 0;
    this._midN    = 0;
    this._farN    = 0;

    // Rebuild timer
    this._timer         = 0;
    this._INTERVAL      = 0.25;  // seconds

    // Do an initial redistribution so meshes are populated immediately.
    // Use world-origin as a stand-in camera position (all trees start as MID).
    this._redistributeWithPos(0, 0);
  }

  // ── Public API ───────────────────────────────────────────────

  update(camera, dt) {
    this._timer += dt;
    if (this._timer < this._INTERVAL) return;
    this._timer = 0;
    this._redistributeWithPos(camera.position.x, camera.position.z);
  }

  setVisible(v) {
    for (const pair of [this.nearPair, this.midPair, this.farPair]) {
      pair.trunk.visible  = v;
      pair.leaves.visible = v;
    }
  }

  dispose(scene) {
    for (const pair of [this.nearPair, this.midPair, this.farPair]) {
      scene.remove(pair.trunk, pair.leaves);
      pair.trunk.geometry.dispose();
      pair.leaves.geometry.dispose();
      // Note: don't dispose shared simpleMats here; TreeSystem disposes materials
    }
  }

  // ── Internals ────────────────────────────────────────────────

  _redistributeWithPos(camX, camZ) {
    const { instances, indices, _tier } = this;
    const treeList = indices ? indices : Array.from({ length: instances.length }, (_, i) => i);
    this._nearN = 0;
    this._midN  = 0;
    this._farN  = 0;

    for (let outIdx = 0; outIdx < treeList.length; outIdx++) {
      const treeIdx = treeList[outIdx];
      const t = instances[treeIdx];
      const dx = t.x - camX;
      const dz = t.z - camZ;
      const d2 = dx * dx + dz * dz;

      // ── Hysteresis state machine ─────────────────────────────
      let tier = _tier[treeIdx];

      if (tier === TIER_NEAR) {
        if (d2 > NEAR_EXIT_D2)  tier = TIER_MID;
      } else if (tier === TIER_MID) {
        if      (d2 < NEAR_ENTER_D2) tier = TIER_NEAR;
        else if (d2 > FAR_ENTER_D2)  tier = TIER_FAR;
      } else {  // TIER_FAR
        if (d2 < FAR_EXIT_D2) tier = TIER_MID;
      }

      _tier[treeIdx] = tier;

      if      (tier === TIER_NEAR) this._nearIdx[this._nearN++] = treeIdx;
      else if (tier === TIER_MID)  this._midIdx[this._midN++]   = treeIdx;
      else                         this._farIdx[this._farN++]   = treeIdx;
    }

    // Slice typed arrays to actual count, then apply
    applyInstancesSubset(instances, this._nearIdx.subarray(0, this._nearN), this.nearPair);
    applyInstancesSubset(instances, this._midIdx.subarray(0,  this._midN),  this.midPair);
    applyInstancesSubset(instances, this._farIdx.subarray(0,  this._farN),  this.farPair);
  }  // ── Stats ────────────────────────────────────────────────────

  getStats() {
    return {
      near: this._nearN,
      mid:  this._midN,
      far:  this._farN,
      total: this.instances.length,
    };
  }
}
