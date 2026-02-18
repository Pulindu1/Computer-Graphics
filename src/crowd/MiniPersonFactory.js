// 📄 src/crowd/MiniPersonFactory.js
import * as THREE from "three";

/**
 * Creates a simple humanoid mesh with articulated parts
 * Based on steering lab humanoid structure
 */
export function createMiniPersonMesh(baseColorHex = 0x3388ff) {
  console.log("[MiniPersonFactory] Creating mesh with color:", baseColorHex.toString(16));
  const group = new THREE.Group();
  
  // Materials
  const bodyMat = new THREE.MeshStandardMaterial({
    color: baseColorHex,
    roughness: 0.7,
    metalness: 0.1,
  });
  
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffccaa,
    roughness: 0.8,
    metalness: 0.0,
  });
  
  // Scale factor for 12x size (3x bigger than previous 4x)
  const scale = 12.0;
  
  // Head
  const headGeo = new THREE.SphereGeometry(0.12 * scale, 8, 8);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.75 * scale;
  group.add(head);
  
  // Torso
  const torsoGeo = new THREE.CylinderGeometry(0.12 * scale, 0.15 * scale, 0.5 * scale, 8);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.y = 0.45 * scale;
  group.add(torso);
  
  // Left leg
  const legGeo = new THREE.BoxGeometry(0.08 * scale, 0.35 * scale, 0.08 * scale);
  const lLeg = new THREE.Mesh(legGeo, bodyMat);
  lLeg.position.set(-0.08 * scale, 0.175 * scale, 0);
  group.add(lLeg);
  
  // Right leg
  const rLeg = new THREE.Mesh(legGeo, bodyMat);
  rLeg.position.set(0.08 * scale, 0.175 * scale, 0);
  group.add(rLeg);
  
  // Left arm
  const armGeo = new THREE.BoxGeometry(0.06 * scale, 0.3 * scale, 0.06 * scale);
  const lArm = new THREE.Mesh(armGeo, bodyMat);
  lArm.position.set(-0.20 * scale, 0.50 * scale, 0);
  group.add(lArm);
  
  // Right arm
  const rArm = new THREE.Mesh(armGeo, bodyMat);
  rArm.position.set(0.20 * scale, 0.50 * scale, 0);
  group.add(rArm);
  
  // Store references for animation
  const parts = {
    head,
    torso,
    lLeg,
    rLeg,
    lArm,
    rArm,
  };
  
  return { mesh: group, parts, bodyMat, skinMat };
}

/**
 * Animates a humanoid with walk cycle and turning (based on steering lab)
 */
export function animateHumanoid(agent, time) {
  const { parts, mesh } = agent;
  const speed = agent.vel.length();
  const isWalking = agent.mode === 1 || agent.mode === 2; // MODE_WALK=1, MODE_FAST=2
  
  // Face direction of movement with smooth quaternion interpolation (always update if moving)
  if (isWalking || speed > 0.001) {
    const targetAngle = Math.atan2(agent.vel.x, agent.vel.z);
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), 
      targetAngle
    );
    mesh.quaternion.slerp(targetQuat, 0.2); // Smooth turning
  }
  
  // Walk cycle animation: animate whenever in WALK or FAST mode
  if (isWalking) {
    // Base frequency at 2 Hz, scales with speed
    const walkFreq = 2.0 + speed * 5.0; // Slower walks = ~2 Hz, faster = scales up
    const phase = time * walkFreq;
    
    // Leg swing (alternating)
    const legSwing = Math.sin(phase) * 0.6;
    parts.lLeg.rotation.x = legSwing;
    parts.rLeg.rotation.x = -legSwing;
    
    // Arm swing (opposite to legs for natural gait)
    const armSwing = Math.sin(phase) * 0.5;
    parts.lArm.rotation.x = -armSwing;
    parts.rArm.rotation.x = armSwing;
    
    // Vertical bob (walk bounce) - more pronounced for faster movement
    const bob = Math.abs(Math.sin(phase * 2)) * (0.05 + speed * 0.15);
    mesh.position.y = agent.pos.y + bob;
  } else {
    // Idle pose: relax limbs gradually and return to rest position
    parts.lLeg.rotation.x *= 0.95;
    parts.rLeg.rotation.x *= 0.95;
    parts.lArm.rotation.x *= 0.95;
    parts.rArm.rotation.x *= 0.95;
    mesh.position.y = agent.pos.y;  // Keep at proper height when idle
  }
  
  // Update XZ position
  mesh.position.x = agent.pos.x;
  mesh.position.z = agent.pos.z;
}
