/**
 * TreeSystem.js
 * Main orchestrator for the procedural tree system.
 *
 * Responsibilities:
 *  - Builds a terrainQuery API from the terrain, river, and street data
 *  - Calls generateTreeInstances() to produce grass-only placement
 *  - Creates full-quality materials (with optional GPU wind shader)
 *  - Delegates rendering to TreeLodBuckets (3-tier LOD) or a single InstancedMesh pair
 *  - Updates wind uniforms per-frame (1 float write — zero CPU matrix work)
 *  - Manages optional TreeDebug overlays
 *  - Exposes rebuild() so UI sliders can trigger instant re-placement
 *
 * Usage:
 *   const trees = new TreeSystem({ scene, terrain, river, streets });
 *   trees.build();
 *   // in animate():
 *   trees.update(camera, dt);
 */

import * as THREE                             from "three";
import { generateTreeInstances }              from "./treePlacement.js";
import { buildTreeMaterials, createTreeMeshPair,
         createSmallTreeMeshPair, getInstancesOfType }  from "./treeMeshes.js";
import { TreeLodBuckets }                     from "./treeLodBuckets.js";
import { TreeDebug }                          from "./treeDebug.js";
import { distanceToRectangle }                from "../../world/streetMask.js";

export class TreeSystem {
  /**
   * @param {object} options
   * @param {THREE.Scene} options.scene
   * @param {object}  options.terrain  – { heightAt: (x,z)=>number }
   * @param {object}  options.river    – { centerX: (z)=>number, riverHalfWidth: number }
   * @param {Array}   options.streets  – [{ centerX, centerZ, halfWidth, halfLength }]
   * @param {object}  [options.params] – override default parameters
   */
  constructor({ scene, terrain, river, streets = [], params = {} }) {
    this.scene   = scene;
    this.terrain = terrain;
    this.river   = river;
    this.streets = streets;

    this.params = {
      // ── Placement ────────────────────────────────────────────
      count:         800,
      minSpacing:    18,   // Matches 10x-scaled tree crown size
      riverMargin:   12,
      // streetMargin covers: halfWidth(50) + shoulderBlend(40) + buffer = 55+
      streetMargin:  55,
      walkwayMargin: 8,
      maxSlope2:     3.0,   // ||∇h||² threshold (allows trees on steep hill sections)
      // ── Wind ─────────────────────────────────────────────────
      windEnabled:   true,
      windStrength:  0.3,   // Lower default: world sway = strength × scale × windFactor
      windSpeed:     1.2,
      // ── LOD ──────────────────────────────────────────────────
      lodEnabled:    true,
      // ── Visibility ───────────────────────────────────────────
      visible:       true,
      ...params,
    };

    // Internal state
    this.instances   = [];
    this._materials  = null;   // { trunk, leaves, leavesUniforms }
    this._lod        = null;   // TreeLodBuckets (large trees)
    this._lodSmall   = null;   // TreeLodBuckets (small trees)
    this._single     = null;   // single-tier mesh pair (large, when lodEnabled=false)
    this._singleSmall = null;  // single-tier mesh pair (small, when lodEnabled=false)
    this._debug      = null;   // TreeDebug

    // Build the terrain query once (re-built only if river/streets change)
    this._query = this._buildQuery();
  }

  // ── Public: Build / Rebuild ───────────────────────────────────

  build() {
    const { scene, params } = this;

    // ── 1. Generate placements (CPU, ~O(count×30) iterations) ──
    this.instances = generateTreeInstances(
      {
        count:         params.count,
        minX: -400, maxX: 400,
        minZ: -1000, maxZ: 1000,
        minSpacing:    params.minSpacing,
        riverMargin:   params.riverMargin,
        streetMargin:  params.streetMargin,
        walkwayMargin: params.walkwayMargin,
        maxSlope2:     params.maxSlope2,
        minHeight:     -3,
      },
      this._query,
    );

    console.log(`[TreeSystem] Placed ${this.instances.length} trees.`);

    // ── 2. Build materials ──────────────────────────────────────
    this._materials = buildTreeMaterials({ windEnabled: params.windEnabled });

    // ── 3. Build renderers ──────────────────────────────────────
    // Separate large and small tree instances
    const largeIndices = getInstancesOfType(this.instances, 'large');
    const smallIndices = getInstancesOfType(this.instances, 'small');

    console.log(`[TreeSystem] ${largeIndices.length} large, ${smallIndices.length} small trees`);

    if (params.lodEnabled) {
      // Large trees with full LOD (3 tiers)
      this._lod = new TreeLodBuckets(scene, this._materials, this.instances, largeIndices);
      this._lod.setVisible(params.visible);

      // Small trees: single tier (no LOD)
      if (smallIndices.length > 0) {
        this._singleSmall = createSmallTreeMeshPair({
          maxCount: smallIndices.length,
          materials: this._materials,
          dynamic: false,
        });
        this._applyInstancesOfType(this.instances, smallIndices, this._singleSmall, true);
        this._singleSmall.trunk.visible  = params.visible;
        this._singleSmall.leaves.visible = params.visible;
        scene.add(this._singleSmall.trunk, this._singleSmall.leaves);
      }
    } else {
      // Large trees: single tier
      this._single = createTreeMeshPair({
        trunkSegs: 7, leafSegs: 8,
        trunkRadius: [0.25, 0.42], trunkHeight: 4.0,
        leafRadius: 1.6, leafHeight: 4.2,
        maxCount: largeIndices.length,
        materials: this._materials,
        dynamic: false,
      });
      if (largeIndices.length > 0) {
        this._applyInstancesOfType(this.instances, largeIndices, this._single, false);
        this._single.trunk.visible  = params.visible;
        this._single.leaves.visible = params.visible;
        scene.add(this._single.trunk, this._single.leaves);
      }

      // Small trees: single tier
      if (smallIndices.length > 0) {
        this._singleSmall = createSmallTreeMeshPair({
          maxCount: smallIndices.length,
          materials: this._materials,
          dynamic: false,
        });
        this._applyInstancesOfType(this.instances, smallIndices, this._singleSmall, true);
        this._singleSmall.trunk.visible  = params.visible;
        this._singleSmall.leaves.visible = params.visible;
        scene.add(this._singleSmall.trunk, this._singleSmall.leaves);
      }
    }

    // ── 4. Refresh debug if it was previously enabled ──────────
    if (this._debug) {
      this._debug.rebuild(scene, this.instances, this._streetDebugData(), this.river);
    }
  }

  /** Dispose and rebuild everything (called by UI sliders). */
  rebuild() {
    this._dispose();
    this.build();
  }

  // ── Public: Per-frame update ──────────────────────────────────

  /**
   * Call once per animation frame.
   * @param {THREE.Camera} camera
   * @param {number} dt – delta time in seconds
   */
  update(camera, dt) {
    // Update wind uniforms — ONE float write per frame regardless of tree count.
    // The GPU shader reads this uniform and applies wind displacement on-chip.
    const u = this._materials?.leavesUniforms;
    if (u) {
      u.uWindTime.value     += dt;
      u.uWindStrength.value  = this.params.windEnabled ? this.params.windStrength : 0.0;
      u.uWindSpeed.value     = this.params.windSpeed;
    }

    // Update LOD tier assignments (runs actual work every 0.25s, not every frame)
    if (this._lod)      this._lod.update(camera, dt);
  }

  // ── Public: Debug ─────────────────────────────────────────────

  enableDebug() {
    if (!this._debug) this._debug = new TreeDebug();
    if (this.instances.length > 0) {
      this._debug.rebuild(this.scene, this.instances, this._streetDebugData(), this.river);
    }
    return this._debug;
  }

  // ── Public: Visibility ────────────────────────────────────────

  setVisible(v) {
    this.params.visible = v;
    if (this._lod)       this._lod.setVisible(v);
    if (this._lodSmall)  this._lodSmall.setVisible(v);
    if (this._single) {
      this._single.trunk.visible  = v;
      this._single.leaves.visible = v;
    }
    if (this._singleSmall) {
      this._singleSmall.trunk.visible  = v;
      this._singleSmall.leaves.visible = v;
    }
  }

  // ── Public: Stats ─────────────────────────────────────────────

  getStats() {
    const base = { total: this.instances.length };
    if (this._lod) return { ...base, ...this._lod.getStats() };
    return base;
  }

  // ── Private helpers ───────────────────────────────────────────

  /** Construct the terrain query API used by treePlacement.js. */
  _buildQuery() {
    const { terrain, river, streets } = this;

    // Walkway occupies the band just outside the river half-width
    // (matches walkwayWidth = 32 in terrainHeight.js, plus a small buffer)
    const WALK_INNER = river.riverHalfWidth ?? 56;
    const WALK_OUTER = WALK_INNER + 34;

    return {
      /**
       * Bilinear-interpolated terrain height.
       * Already O(1) — reads from the baked height grid.
       */
      getHeightAt: (x, z) => terrain.heightAt(x, z),

      /**
       * Squared slope magnitude via central finite differences.
       * Returns ||∇h||² so callers can compare against maxSlope² without sqrt.
       */
      getSlopeAt: (x, z, eps = 0.75) => {
        const hL = terrain.heightAt(x - eps, z);
        const hR = terrain.heightAt(x + eps, z);
        const hD = terrain.heightAt(x, z - eps);
        const hU = terrain.heightAt(x, z + eps);
        const dx = (hR - hL) / (2 * eps);
        const dz = (hU - hD) / (2 * eps);
        return dx * dx + dz * dz;
      },

      /**
       * True if (x,z) is inside the river corridor (+ margin).
       * Uses same meander equation as terrain/water/corridor modules.
       */
      isInsideRiver: (x, z, margin = 0) => {
        const cx = river.centerX(z);
        return Math.abs(x - cx) < (WALK_INNER + margin);
      },

      /**
       * True if (x,z) is inside or within `margin` units of any street rectangle.
       * distanceToRectangle returns 0 when inside, positive distance when outside.
       */
      isOnStreet: (x, z, margin = 0) => {
        for (const s of streets) {
          const d = distanceToRectangle(
            x, z,
            s.centerX, s.centerZ,
            s.halfWidth, s.halfLength,
          );
          if (d < margin) return true;
        }
        return false;
      },

      /**
       * True if (x,z) falls within the walkway band on either side of the river.
       * Prevents trees from growing on the riverside platforms.
       */
      isOnWalkway: (x, z, margin = 0) => {
        const cx = river.centerX(z);
        const d  = Math.abs(x - cx);
        return d >= (WALK_INNER - margin) && d <= (WALK_OUTER + margin);
      },
    };
  }

  /** Street data formatted for the debug overlay (adds height for box Y). */
  _streetDebugData() {
    return this.streets.map(s => ({
      centerX:    s.centerX,
      centerZ:    s.centerZ,
      halfWidth:  s.halfWidth,
      halfLength: s.halfLength,
      centerY:    this.terrain.heightAt(s.centerX, s.centerZ),
    }));
  }

  /** Tear down all GPU resources without triggering a rebuild. */
  _dispose() {
    const { scene } = this;

    if (this._lod) {
      this._lod.dispose(scene);
      this._lod = null;
    }

    if (this._single) {
      scene.remove(this._single.trunk, this._single.leaves);
      this._single.trunk.geometry.dispose();
      this._single.leaves.geometry.dispose();
      this._single = null;
    }
    if (this._singleSmall) {
      scene.remove(this._singleSmall.trunk, this._singleSmall.leaves);
      this._singleSmall.trunk.geometry.dispose();
      this._singleSmall.leaves.geometry.dispose();
      this._singleSmall = null;
    }

    if (this._materials) {
      this._materials.trunk.dispose();
      this._materials.leaves.dispose();
      this._materials = null;
    }

    if (this._debug) {
      this._debug.dispose(scene);
      // Keep the TreeDebug object alive (its rebuild() will re-populate after build)
    }
  }

  /** Helper: apply instances by type (large or small). */
  _applyInstancesOfType(instances, indices, pair, isSmall) {
    const dummy = new THREE.Object3D();
    const n = indices.length;
    pair.trunk.count  = n;
    pair.leaves.count = n;

    for (let i = 0; i < n; i++) {
      const t = instances[indices[i]];
      const scaleFactor = isSmall ? 0.66 : 1.0; // Small trees are 2/3 scale (doubled from 1/3)

      // Trunk position + scale
      dummy.position.set(t.x, t.y + 2.0 * t.scale * scaleFactor, t.z);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.setScalar(t.scale * scaleFactor);
      dummy.updateMatrix();
      pair.trunk.setMatrixAt(i, dummy.matrix);

      // Leaves position + scale (adjusted for 2-sphere foliage)
      dummy.position.set(t.x, t.y + 4.8 * t.scale * scaleFactor, t.z);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.setScalar(t.scale * scaleFactor);
      dummy.updateMatrix();
      pair.leaves.setMatrixAt(i, dummy.matrix);
    }

    pair.trunk.instanceMatrix.needsUpdate  = true;
    pair.leaves.instanceMatrix.needsUpdate = true;
  }
}
