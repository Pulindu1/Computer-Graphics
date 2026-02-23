
import * as THREE from "three";

export class ChunkedInstancing {
  constructor(geometry, material, chunkSize = 128, maxInstancesPerChunk = 512) {
    this.geometry = geometry;
    this.material = material;
    this.chunkSize = chunkSize;
    this.maxInstancesPerChunk = maxInstancesPerChunk;
    this.chunks = new Map();
    this.dummy = new THREE.Object3D();
    this.zeroScale = 0.0001;
  }

  _packKey(cx, cz) {
    const OFF = 1 << 15;
    const MASK = (1 << 16) - 1;
    const x = (cx + OFF) & MASK;
    const z = (cz + OFF) & MASK;
    return (x << 16) | z;
  }


  getChunk(cx, cz) {
    const key = this._packKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const mesh = new THREE.InstancedMesh(
        this.geometry,
        this.material,
        this.maxInstancesPerChunk
      );
      mesh.frustumCulled = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      
      chunk = {
        mesh,
        ids: [],
        worldPos: {
          x: cx * this.chunkSize + this.chunkSize / 2,
          z: cz * this.chunkSize + this.chunkSize / 2,
        },
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }


  rebuildChunks(agentCount, posX, posZ) {
    for (const chunk of this.chunks.values()) {
      chunk.ids.length = 0;
    }

    for (let i = 0; i < agentCount; i++) {
      const cx = Math.floor(posX[i] / this.chunkSize);
      const cz = Math.floor(posZ[i] / this.chunkSize);
      const chunk = this.getChunk(cx, cz);
      if (chunk.ids.length < this.maxInstancesPerChunk) {
        chunk.ids.push(i);
      }
    }

    // Update mesh counts
    for (const chunk of this.chunks.values()) {
      chunk.mesh.count = chunk.ids.length;
    }
  }

  setHidden(mesh, localIdx) {
    this.dummy.position.set(0, -99999, 0);
    this.dummy.scale.setScalar(this.zeroScale);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(localIdx, this.dummy.matrix);
  }

  updateAllChunks(posX, posY, posZ, lodState, nearOnly = false) {
    for (const chunk of this.chunks.values()) {
      let needsUpdate = false;

      for (let localIdx = 0; localIdx < chunk.ids.length; localIdx++) {
        const agentId = chunk.ids[localIdx];
        
        const matchesLOD = nearOnly ? (lodState[agentId] === 1) : (lodState[agentId] === 0);
        
        if (matchesLOD) {
          this.dummy.position.set(posX[agentId], posY[agentId], posZ[agentId]);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.setScalar(1);
          this.dummy.updateMatrix();
          chunk.mesh.setMatrixAt(localIdx, this.dummy.matrix);
        } else {
          this.setHidden(chunk.mesh, localIdx);
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        chunk.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  addToScene(scene) {
    for (const chunk of this.chunks.values()) {
      scene.add(chunk.mesh);
    }
  }

  removeFromScene(scene) {
    for (const chunk of this.chunks.values()) {
      scene.remove(chunk.mesh);
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.mesh.geometry.dispose();
      chunk.mesh.material.dispose();
    }
    this.chunks.clear();
  }
}
