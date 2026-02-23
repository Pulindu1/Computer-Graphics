
import * as THREE from "three";


function createBillboardQuad() {
  const geometry = new THREE.BufferGeometry();
  

  const positions = new Float32Array([
    -0.5, -0.5, 0,  // bottom-left
     0.5, -0.5, 0,  // bottom-right
     0.5,  0.5, 0,  // top-right
    -0.5,  0.5, 0,  // top-left
  ]);
  
  const uvs = new Float32Array([
    0, 1,  // bottom-left
    1, 1,  // bottom-right
    1, 0,  // top-right
    0, 0,  // top-left
  ]);
  
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create materials for vegetation.
 * @param {object} textures - { rock: Texture }
 */
export function buildVegetationMaterials(textures) {
  const material = new THREE.MeshStandardMaterial({
    map: null,
    side: THREE.DoubleSide,
    metalness: 0.0,
    roughness: 1.0,
    flatShading: false,
    transparent: true,
    alphaTest: 0.1,
  });
  
  return {
    rock: material.clone(),
  };
}

/**
 * Create instanced mesh pair for vegetation type (rock or stump).
 * @param {object} params
 *   maxCount, texture, material
 */
export function createVegetationMeshPair(maxCount, texture, material) {
  const geometry = createBillboardQuad();
  
  // Set texture
  const mat = material.clone();
  mat.map = texture;
  
  const mesh = new THREE.InstancedMesh(geometry, mat, maxCount);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.count = 0;
  
  return mesh;
}


export function getVegetationByType(instances, type) {
  const indices = [];
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].type === type) indices.push(i);
  }
  return indices;
}


export function applyVegetationMatrices(instances, indices, mesh, camera) {
  const n = indices.length;
  mesh.count = n;
  
  const dummy = new THREE.Object3D();
  const cameraDir = new THREE.Vector3();
  
  for (let i = 0; i < n; i++) {
    const inst = instances[indices[i]];
    const pos = new THREE.Vector3(inst.x, inst.y, inst.z);
    

    cameraDir.subVectors(camera.position, pos).normalize();
    
    dummy.position.copy(pos);
    dummy.scale.set(4.5, 4.5, 1.5);
    
    dummy.lookAt(camera.position);
    dummy.rotateZ(inst.rotY * 0.2);
    
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  
  mesh.instanceMatrix.needsUpdate = true;
}
