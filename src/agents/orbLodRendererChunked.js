// 📄 src/agents/orbLodRendererChunked.js
import * as THREE from "three";
import { ChunkedInstancing } from "./chunkedInstancing.js";

export function createOrbLodRenderer({
  count,
  nearRadius = 0.65,
  farRadius = 0.8, // Increased significantly for visibility at distance

  // LOD switching distance
  lodDistance = 70,
  hysteresis = 10,
  
  // Chunking parameters (optimization 7)
  chunkSize = 256,
  maxInstancesPerChunk = 512,

  // visual tuning
  nearEmissive = 0x9bd7ff,
  farEmissive = 0xffffff,
  nearEmissiveIntensity = 2.2,
  farEmissiveIntensity = 2.5, // Boosted from 1.4 for distance visibility
} = {}) {
  const nearGeo = new THREE.SphereGeometry(nearRadius, 10, 10);
  const farGeo = new THREE.SphereGeometry(farRadius, 8, 8);

  const nearMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(nearEmissive),
    emissiveIntensity: nearEmissiveIntensity,
    roughness: 0.25,
    metalness: 0.0,
  });

  const farMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(farEmissive),
    emissiveIntensity: farEmissiveIntensity,
    roughness: 0.35,
    metalness: 0.0,
  });

  // Create chunked instancing systems (optimization 7)
  const nearChunks = new ChunkedInstancing(nearGeo, nearMat, chunkSize, maxInstancesPerChunk);
  const farChunks = new ChunkedInstancing(farGeo, farMat, chunkSize, maxInstancesPerChunk);

  const lodState = new Uint8Array(count);
  let lastCamPos = null;
  let frame = 0;
  let chunksBuilt = false;

  const NEAR_THRESHOLD_2 = (lodDistance - hysteresis) ** 2;
  const FAR_THRESHOLD_2 = (lodDistance + hysteresis) ** 2;

  function updateInstances(swarm, camera) {
    frame++;
    const camPos = camera.position;
    
    // Skip update if camera static and frame % 4 !== 0
    if (lastCamPos) {
      const dx = camPos.x - lastCamPos.x;
      const dy = camPos.y - lastCamPos.y;
      const dz = camPos.z - lastCamPos.z;
      const moveDist2 = dx * dx + dy * dy + dz * dz;
      
      if (moveDist2 < 0.25 && (frame & 3) !== 0) return;
    }
    
    if (!lastCamPos) lastCamPos = new THREE.Vector3();
    lastCamPos.copy(camPos);
    
    const camX = camPos.x;
    const camY = camPos.y;
    const camZ = camPos.z;
    
    // Direct array access (SoA optimization 8)
    const { posX, posY, posZ } = swarm;
    
    // Rebuild chunks every second
    if (!chunksBuilt || (frame % 60) === 0) {
      console.log(`Rebuilding chunks for ${swarm.count} agents`);
      nearChunks.rebuildChunks(swarm.count, posX, posZ);
      farChunks.rebuildChunks(swarm.count, posX, posZ);
      console.log(`Near chunks: ${nearChunks.chunks.size}, Far chunks: ${farChunks.chunks.size}`);
      chunksBuilt = true;
    }

    // Update LOD states
    for (let i = 0; i < swarm.count; i++) {
      const dx = posX[i] - camX;
      const dy = posY[i] - camY;
      const dz = posZ[i] - camZ;
      const d2 = dx * dx + dy * dy + dz * dz;

      const wasNear = lodState[i] === 1;
      let nowNear = wasNear;
      
      if (wasNear && d2 > FAR_THRESHOLD_2) nowNear = false;
      else if (!wasNear && d2 < NEAR_THRESHOLD_2) nowNear = true;

      lodState[i] = nowNear ? 1 : 0;
    }
    
    // Update chunks
    nearChunks.updateAllChunks(posX, posY, posZ, lodState, true);
    farChunks.updateAllChunks(posX, posY, posZ, lodState, false);
    
    if (frame === 1) {
      let nearCount = 0, farCount = 0;
      for (let i = 0; i < swarm.count; i++) {
        if (lodState[i] === 1) nearCount++;
        else farCount++;
      }
      console.log(`LOD states: ${nearCount} near, ${farCount} far`);
    }
  }

  const baseNearIntensity = nearEmissiveIntensity;
  const baseFarIntensity = farEmissiveIntensity;

  function setBrightness(mult) {
    nearMat.emissiveIntensity = baseNearIntensity * mult;
    farMat.emissiveIntensity = baseFarIntensity * mult;
  }
  
  function addToScene(scene) {
    nearChunks.addToScene(scene);
    farChunks.addToScene(scene);
  }
  
  function removeFromScene(scene) {
    nearChunks.removeFromScene(scene);
    farChunks.removeFromScene(scene);
  }

  return {
    updateInstances,
    setBrightness,
    addToScene,
    removeFromScene,
    nearChunks,
    farChunks,
  };
}
