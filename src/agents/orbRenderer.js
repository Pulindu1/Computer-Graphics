// 📄 src/agents/orbRenderer.js
import * as THREE from "three";

export function createOrbRenderer({
  count,
  radius = 0.6,
} = {}) {
  const geo = new THREE.SphereGeometry(radius, 8, 8);

  // Emissive “light ball” without real lights (fast)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0x9bd7ff),
    emissiveIntensity: 2.0,
    roughness: 0.35,
    metalness: 0.0,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = "OrbSwarm";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const tmpObj = new THREE.Object3D();

  function updateInstances(swarm) {
    for (let i = 0; i < swarm.count; i++) {
      const p = swarm.getWorldPosition(i, tmpObj.position);
      tmpObj.position.set(p.x, p.y, p.z);

      // optional: tiny scale variation based on i
      tmpObj.scale.setScalar(1.0);

      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, updateInstances };
}
