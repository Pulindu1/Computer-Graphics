
import * as THREE from "three";


export function createRiverWalkways({
  riverCorridor,
  offsetDistance = 8,
  width = 6,
  segments = 200,
  height = 0.1,
  railHeight = 1.5,
  color = 0x888888,
  railColor = 0x555555,
} = {}) {
  const { zMin, zMax, centerX, riverHalfWidth, waterLevel } = riverCorridor;
  
  // Generate offset points along river
  const leftEdge1 = [];
  const leftEdge2 = [];
  const rightEdge1 = [];
  const rightEdge2 = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = zMin + t * (zMax - zMin);
    
    const cx = centerX(z);
    
    // Calculate tangent by sampling nearby points
    const dz = 1.0;
    const cx_before = centerX(z - dz);
    const cx_after = centerX(z + dz);
    const tangent = new THREE.Vector3(
      cx_after - cx_before,
      0,
      2 * dz
    ).normalize();
    

    const normal = new THREE.Vector3(
      -tangent.z,
      0,
      tangent.x
    ).normalize();
    

    const leftInner = riverHalfWidth + offsetDistance;
    const leftOuter = riverHalfWidth + offsetDistance + width;
    
    leftEdge1.push(new THREE.Vector3(
      cx + normal.x * leftOuter,
      height,
      z
    ));
    leftEdge2.push(new THREE.Vector3(
      cx + normal.x * leftInner,
      height,
      z
    ));
    

    const rightInner = -(riverHalfWidth + offsetDistance);
    const rightOuter = -(riverHalfWidth + offsetDistance + width);
    
    rightEdge1.push(new THREE.Vector3(
      cx + normal.x * rightInner,
      height,
      z
    ));
    rightEdge2.push(new THREE.Vector3(
      cx + normal.x * rightOuter,
      height,
      z
    ));
  }
  
  // Build meshes
  const leftMesh = buildPlatformMesh(leftEdge1, leftEdge2, color);
  const rightMesh = buildPlatformMesh(rightEdge1, rightEdge2, color);
  
  // Build railings on both edges
  const leftOuterRail = buildRailing(leftEdge1, height, railHeight, railColor);
  const leftInnerRail = buildRailing(leftEdge2, height, railHeight, railColor);
  const rightOuterRail = buildRailing(rightEdge2, height, railHeight, railColor);
  const rightInnerRail = buildRailing(rightEdge1, height, railHeight, railColor);
  
  // Group platforms and rails
  const leftGroup = new THREE.Group();
  leftGroup.add(leftMesh);
  leftGroup.add(leftOuterRail);
  leftGroup.add(leftInnerRail);
  
  const rightGroup = new THREE.Group();
  rightGroup.add(rightMesh);
  rightGroup.add(rightOuterRail);
  rightGroup.add(rightInnerRail);
  
  return { leftMesh: leftGroup, rightMesh: rightGroup };
}


function buildPlatformMesh(edge1, edge2, color) {
  const vertices = [];
  const indices = [];
  
  for (let i = 0; i < edge1.length; i++) {
    vertices.push(edge1[i].x, edge1[i].y, edge1[i].z);
    vertices.push(edge2[i].x, edge2[i].y, edge2[i].z);
  }
  
  for (let i = 0; i < edge1.length - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  
  return new THREE.Mesh(geometry, material);
}


function buildRailing(edge, baseHeight, railHeight, color) {
  const vertices = [];
  const indices = [];
  
  const topHeight = baseHeight + railHeight;
  
  for (let i = 0; i < edge.length; i++) {
    vertices.push(edge[i].x, baseHeight, edge[i].z);
    vertices.push(edge[i].x, topHeight, edge[i].z);
  }
  
  for (let i = 0; i < edge.length - 1; i++) {
    const a = i * 2;       // bottom current
    const b = i * 2 + 1;   // top current
    const c = i * 2 + 2;   // bottom next
    const d = i * 2 + 3;   // top next
    
    // Two triangles per segment
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  
  return new THREE.Mesh(geometry, material);
}
