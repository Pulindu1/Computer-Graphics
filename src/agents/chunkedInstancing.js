// 📄 src/agents/chunkedInstancing.js
import * as THREE from "three";

/**
 * Chunked instancing system for frustum culling at chunk granularity
 * Splits instances across multiple InstancedMeshes based on spatial position
 */
export class ChunkedInstancing {
  constructor(geometry, material, chunkSize = 128, maxInstancesPerChunk = 512) {
    this.geometry = geometry;
    this.material = material;
    this.chunkSize = chunkSize;
    this.maxInstancesPerChunk = maxInstancesPerChunk;
    this.chunks = new Map(); // packed key -> { mesh, ids: [], worldPos: {x, z} }
    this.dummy = new THREE.Object3D();
    this.zeroScale = 0.0001;
  }

  // Pack chunk coords into integer key
  _packKey(cx, cz) {
    const OFF = 1 << 15;
    const MASK = (1 << 16) - 1;
    const x = (cx + OFF) & MASK;
    const z = (cz + OFF) & MASK;
    return (x << 16) | z;
  }

  // Get or create chunk
  getChunk(cx, cz) {
    const key = this._packKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const mesh = new THREE.InstancedMesh(
        this.geometry,
        this.material,
        this.maxInstancesPerChunk
      );
      mesh.frustumCulled = true; // Enable frustum culling per chunk
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      
      chunk = {
        mesh,
        ids: [], // Agent IDs in this chunk
        worldPos: {
          x: cx * this.chunkSize + this.chunkSize / 2,
          z: cz * this.chunkSize + this.chunkSize / 2,
        },
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  // Assign agents to chunks based on position
  rebuildChunks(agentCount, posX, posZ) {
    // Clear all chunk agent lists
    for (const chunk of this.chunks.values()) {
      chunk.ids.length = 0;
    }

    // Assign each agent to its chunk
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

  // Set hidden instance (off-screen or wrong LOD)
  setHidden(mesh, localIdx) {
    this.dummy.position.set(0, -99999, 0);
    this.dummy.scale.setScalar(this.zeroScale);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(localIdx, this.dummy.matrix);
  }

  // Update instance matrices for all chunks
  updateAllChunks(posX, posY, posZ, lodState, nearOnly = false) {
    for (const chunk of this.chunks.values()) {
      let needsUpdate = false;

      for (let localIdx = 0; localIdx < chunk.ids.length; localIdx++) {
        const agentId = chunk.ids[localIdx];
        
        // Check LOD state (0 = far, 1 = near)
        const matchesLOD = nearOnly ? (lodState[agentId] === 1) : (lodState[agentId] === 0);
        
        if (matchesLOD) {
          // Set visible transform
          this.dummy.position.set(posX[agentId], posY[agentId], posZ[agentId]);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.setScalar(1);
          this.dummy.updateMatrix();
          chunk.mesh.setMatrixAt(localIdx, this.dummy.matrix);
        } else {
          // Hide instances that don't match this LOD
          this.setHidden(chunk.mesh, localIdx);
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        chunk.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // Add all chunk meshes to scene
  addToScene(scene) {
    for (const chunk of this.chunks.values()) {
      scene.add(chunk.mesh);
    }
  }

  // Remove all chunk meshes from scene
  removeFromScene(scene) {
    for (const chunk of this.chunks.values()) {
      scene.remove(chunk.mesh);
    }
  }

  // Dispose all resources
  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.mesh.geometry.dispose();
      chunk.mesh.material.dispose();
    }
    this.chunks.clear();
  }
}
