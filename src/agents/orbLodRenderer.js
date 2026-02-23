import * as THREE from "three";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createOrbLodRenderer({
  count,
  nearRadius = 0.65,
  farRadius = 0.35,

  // LOD switching distance
  lodDistance = 70,
  hysteresis = 10,

  // visual tuning
  nearEmissive = 0x9bd7ff,
  farEmissive = 0xffffff,
  nearEmissiveIntensity = 2.2,
  farEmissiveIntensity = 1.4,
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

  // Far LOD = a tighter spark
  const farMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(farEmissive),
    emissiveIntensity: farEmissiveIntensity,
    roughness: 0.35,
    metalness: 0.0,
  });

  const nearMesh = new THREE.InstancedMesh(nearGeo, nearMat, count);
  const farMesh = new THREE.InstancedMesh(farGeo, farMat, count);
  nearMesh.name = "Orbs_NEAR";
  farMesh.name = "Orbs_FAR";

  nearMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  farMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // 0 = far, 1 = near
  const lodState = new Uint8Array(count);

  const tmp = new THREE.Object3D();
  const zeroScale = 0.0001;

  function setHidden(mesh, i) {
    tmp.position.set(0, -99999, 0);
    tmp.scale.setScalar(zeroScale);
    tmp.rotation.set(0, 0, 0);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  }

  function updateInstances(swarm, camera) {
    const camPos = camera.position;

    for (let i = 0; i < swarm.count; i++) {
      swarm.getWorldPosition(i, tmp.position);
      const dx = tmp.position.x - camPos.x;
      const dy = tmp.position.y - camPos.y;
      const dz = tmp.position.z - camPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const wasNear = lodState[i] === 1;
      const enterNear = d < (lodDistance - hysteresis);
      const exitNear = d > (lodDistance + hysteresis);

      let nowNear = wasNear;
      if (wasNear && exitNear) nowNear = false;
      if (!wasNear && enterNear) nowNear = true;
      lodState[i] = nowNear ? 1 : 0;

      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();

      if (nowNear) {
        nearMesh.setMatrixAt(i, tmp.matrix);
        setHidden(farMesh, i);
      } else {
        farMesh.setMatrixAt(i, tmp.matrix);
        setHidden(nearMesh, i);
      }
    }

    nearMesh.instanceMatrix.needsUpdate = true;
    farMesh.instanceMatrix.needsUpdate = true;
  }

  const baseNearIntensity = nearEmissiveIntensity;
  const baseFarIntensity = farEmissiveIntensity;

  function setBrightness(mult) {
    nearMat.emissiveIntensity = baseNearIntensity * mult;
    farMat.emissiveIntensity = baseFarIntensity * mult;
  }

  return { nearMesh, farMesh, updateInstances, setBrightness };
}
