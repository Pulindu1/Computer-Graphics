

import * as THREE from "three";
import { generateVegetationInstances } from "./vegetationPlacement.js";
import { buildVegetationMaterials, createVegetationMeshPair, 
         getVegetationByType, applyVegetationMatrices } from "./vegetationMeshes.js";
import { distanceToRectangle } from "../../world/streetMask.js";

export class VegetationSystem {
  constructor({ scene, terrain, river, streets = [], params = {} }) {
    this.scene = scene;
    this.terrain = terrain;
    this.river = river;
    this.streets = streets;

    this.params = {
      count: 400,
      minSpacing: 8,
      riverMargin: 12,
      streetMargin: 55,
      walkwayMargin: 8,
      maxSlope2: 3.0,
      visible: true,
      ...params,
    };

    this.instances = [];
    this._materials = null;
    this._rockMesh = null;
    this._query = this._buildQuery();
  }


  _buildQuery() {
    const { terrain, river, streets } = this;
    const WALK_INNER = river.riverHalfWidth ?? 56;
    const WALK_OUTER = WALK_INNER + 34;

    return {
      getHeightAt: (x, z) => terrain.heightAt(x, z),

      getSlopeAt: (x, z, eps = 0.75) => {
        const hL = terrain.heightAt(x - eps, z);
        const hR = terrain.heightAt(x + eps, z);
        const hD = terrain.heightAt(x, z - eps);
        const hU = terrain.heightAt(x, z + eps);
        const dx = (hR - hL) / (2 * eps);
        const dz = (hU - hD) / (2 * eps);
        return dx * dx + dz * dz;
      },
      
      isInsideRiver: (x, z, margin) => {
        const centerX = river.centerX(z);
        const dist = Math.abs(x - centerX);
        return dist < (river.riverHalfWidth ?? 56) + margin;
      },
      
      isOnStreet: (x, z, margin) => {
        return streets.some(street => {
          const dx = Math.abs(x - street.centerX);
          const dz = Math.abs(z - street.centerZ);
          return dx <= street.halfWidth + margin && dz <= street.halfLength + margin;
        });
      },
      
      isOnWalkway: (x, z, margin) => {
        const centerX = river.centerX(z);
        const dist = Math.abs(x - centerX);
        return dist >= WALK_INNER - margin && dist <= WALK_OUTER + margin;
      },
    };
  }


  build() {
    const { scene, params } = this;

    // Generate placement
    this.instances = generateVegetationInstances(
      {
        count: params.count,
        minX: -400, maxX: 400,
        minZ: -1000, maxZ: 1000,
        minSpacing: params.minSpacing,
        riverMargin: params.riverMargin,
        streetMargin: params.streetMargin,
        walkwayMargin: params.walkwayMargin,
        maxSlope2: params.maxSlope2,
      },
      this._query
    );

    console.log(`[VegetationSystem] Placed ${this.instances.length} vegetation items`);

    // Load textures
    const loader = new THREE.TextureLoader();
    const rockTex = loader.load('src/textures/rock.png');

    // Build materials
    this._materials = buildVegetationMaterials({ rock: rockTex });

    // Separate by type
    const rockIndices = getVegetationByType(this.instances, 'rock');

    console.log(`[VegetationSystem] ${rockIndices.length} rocks`);

    // Create meshes
    if (rockIndices.length > 0) {
      this._rockMesh = createVegetationMeshPair(rockIndices.length, rockTex, this._materials.rock);
      applyVegetationMatrices(this.instances, rockIndices, this._rockMesh, this.scene.userData.camera || new THREE.Camera());
      this._rockMesh.visible = params.visible;
      scene.add(this._rockMesh);
    }
  }


  update(camera) {
    const rockIndices = getVegetationByType(this.instances, 'rock');

    if (this._rockMesh) {
      applyVegetationMatrices(this.instances, rockIndices, this._rockMesh, camera);
    }
  }


  setVisible(v) {
    if (this._rockMesh) this._rockMesh.visible = v;
  }

  dispose() {
    const { scene } = this;
    
    if (this._rockMesh) {
      scene.remove(this._rockMesh);
      this._rockMesh.geometry.dispose();
      this._rockMesh = null;
    }

    if (this._materials) {
      Object.values(this._materials).forEach(mat => mat.dispose());
      this._materials = null;
    }
  }
}
