/**
 * treeDebug.js
 * Optional debug visualisations for the tree placement system.
 *
 * Three overlays (each independently toggleable):
 *  1. showPoints  – a Points mesh with a dot at every accepted tree position
 *     (green, size-attenuated) — proves placement is grass-only, not in river/streets
 *
 *  2. showNoZones – translucent overlays showing the excluded zones:
 *     • Blue strip along the river corridor
 *     • Orange boxes around each street rectangle
 *
 * All overlays are rebuilt by rebuild() and can be toggled without rebuild.
 */

import * as THREE from "three";

export class TreeDebug {
  constructor() {
    this._pointsMesh  = null;   // THREE.Points
    this._riverBand   = null;   // THREE.Mesh (plane strip)
    this._streetBoxes = [];     // THREE.Mesh[]

    // Cached visibility state so rebuild() restores correct visibility
    this._showPoints   = false;
    this._showNoZones  = false;
  }

  // ── Build ────────────────────────────────────────────────────

  /**
   * @param {THREE.Scene} scene
   * @param {Array}  instances  – accepted tree placements { x, y, z }
   * @param {Array}  streets    – [{ centerX, centerZ, halfWidth, halfLength, centerY? }]
   * @param {object} river      – { centerX: fn, riverHalfWidth: number }
   */
  rebuild(scene, instances, streets, river) {
    this.dispose(scene);

    // ── 1. Placement point cloud ─────────────────────────────────
    const ptGeo = new THREE.BufferGeometry();
    const pts   = new Float32Array(instances.length * 3);
    for (let i = 0; i < instances.length; i++) {
      pts[i * 3 + 0] = instances[i].x;
      pts[i * 3 + 1] = instances[i].y + 0.5;  // slightly above ground
      pts[i * 3 + 2] = instances[i].z;
    }
    ptGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));

    this._pointsMesh = new THREE.Points(ptGeo, new THREE.PointsMaterial({
      color:           0x00ff44,
      size:            2.5,
      sizeAttenuation: true,
      depthTest:       true,
    }));
    this._pointsMesh.name    = 'TreeDebug_Points';
    this._pointsMesh.visible = this._showPoints;
    scene.add(this._pointsMesh);

    // ── 2a. River exclusion band ─────────────────────────────────
    // Approximate with a flat wide strip along Z-axis (river meanders but the
    // approximate band still communicates the exclusion zone clearly).
    const bandWidth = (river.riverHalfWidth ?? 56) * 2 + 40;  // half-width * 2 + margin * 2
    const bandGeo   = new THREE.PlaneGeometry(bandWidth, 2000, 1, 1);
    bandGeo.rotateX(-Math.PI / 2);

    this._riverBand = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({
      color:      0x4488ff,
      transparent: true,
      opacity:     0.18,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    }));
    this._riverBand.position.set(0, 1.5, 0);
    this._riverBand.name    = 'TreeDebug_RiverBand';
    this._riverBand.visible = this._showNoZones;
    scene.add(this._riverBand);

    // ── 2b. Street exclusion boxes ───────────────────────────────
    for (const s of streets) {
      const sGeo = new THREE.BoxGeometry(
        (s.halfWidth  + 10) * 2,   // halfWidth  + streetMargin
        8,
        (s.halfLength + 10) * 2    // halfLength + streetMargin
      );
      const box = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({
        color:       0xff8800,
        transparent: true,
        opacity:     0.15,
        depthWrite:  false,
        side:        THREE.DoubleSide,
        wireframe:   false,
      }));
      box.position.set(s.centerX, (s.centerY ?? 0) + 4, s.centerZ);
      box.name    = 'TreeDebug_StreetBox';
      box.visible = this._showNoZones;
      scene.add(box);
      this._streetBoxes.push(box);
    }
  }

  // ── Visibility toggles ───────────────────────────────────────

  setShowPoints(v) {
    this._showPoints = v;
    if (this._pointsMesh) this._pointsMesh.visible = v;
  }

  setShowNoZones(v) {
    this._showNoZones = v;
    if (this._riverBand) this._riverBand.visible = v;
    for (const b of this._streetBoxes) b.visible = v;
  }

  // ── Dispose ──────────────────────────────────────────────────

  dispose(scene) {
    if (this._pointsMesh) {
      scene.remove(this._pointsMesh);
      this._pointsMesh.geometry.dispose();
      this._pointsMesh.material.dispose();
      this._pointsMesh = null;
    }
    if (this._riverBand) {
      scene.remove(this._riverBand);
      this._riverBand.geometry.dispose();
      this._riverBand.material.dispose();
      this._riverBand = null;
    }
    for (const b of this._streetBoxes) {
      scene.remove(b);
      b.geometry.dispose();
      b.material.dispose();
    }
    this._streetBoxes = [];
  }
}
