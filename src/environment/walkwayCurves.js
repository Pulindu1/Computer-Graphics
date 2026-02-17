// 📄 src/environment/walkwayCurves.js
import * as THREE from "three";

/**
 * Generate spline curves for walkways based on river corridor
 */
export function createWalkwayCurves({
  riverCorridor,
  offsetDistance = 8,
  width = 6,
  samples = 100,
} = {}) {
  const { zMin, zMax, centerX, riverHalfWidth } = riverCorridor;
  
  // Sample points along river
  const leftPoints = [];
  const rightPoints = [];
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const z = zMin + t * (zMax - zMin);
    const cx = centerX(z);
    
    // Calculate normal
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
    
    // Calculate center of each walkway (between inner and outer edges)
    const leftCenter = riverHalfWidth + offsetDistance + width / 2;
    const rightCenter = -(riverHalfWidth + offsetDistance + width / 2);
    
    leftPoints.push(new THREE.Vector3(
      cx + normal.x * leftCenter,
      0, // Y will be set by walkway zone
      z
    ));
    
    rightPoints.push(new THREE.Vector3(
      cx + normal.x * rightCenter,
      0,
      z
    ));
  }
  
  // Create Catmull-Rom curves
  const leftCurve = new THREE.CatmullRomCurve3(leftPoints);
  const rightCurve = new THREE.CatmullRomCurve3(rightPoints);
  
  return { leftCurve, rightCurve };
}
