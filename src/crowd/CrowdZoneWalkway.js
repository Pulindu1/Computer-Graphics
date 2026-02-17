// 📄 src/crowd/CrowdZoneWalkway.js
import * as THREE from "three";
import { createMiniPersonMesh, animateHumanoid } from "./MiniPersonFactory.js";
import { SpatialHashGrid } from "./SpatialHashGrid.js";

/**
 * Manages a crowd of agents on a walkway following a spline path
 */
export class WalkwayZone {
  constructor({
    scene,
    curve,                    // CatmullRomCurve3 for walkway centerline
    corridorWidth = 6.0,      // walkable width
    laneOffsets = [-1.2, 1.2], // left/right lane positions
    yOffset = 0.12,           // lift above platform
    lookAheadT = 0.01,        // spline lookahead distance
    neighborRadius = 4.0,
    brakeRadius = 2.0,
    platformHeight = -0.8,    // base height of walkway
  } = {}) {
    this.scene = scene;
    this.curve = curve;
    this.corridorWidth = corridorWidth;
    this.laneOffsets = laneOffsets;
    this.yOffset = yOffset;
    this.lookAheadT = lookAheadT;
    this.neighborRadius = neighborRadius;
    this.brakeRadius = brakeRadius;
    this.platformHeight = platformHeight;
    
    this.agents = [];
    this.grid = new SpatialHashGrid(neighborRadius);
    
    // Tunable weights (will be exposed to UI)
    this.weights = {
      path: 1.0,
      contain: 2.0,
      sep: 1.5,
      ali: 0.5,
      coh: 0.3,
      queue: 1.0,
    };
  }
  
  /**
   * Spawn n agents on the walkway
   */
  spawn(count) {
    for (let i = 0; i < count; i++) {
      const { mesh, parts, bodyMat, skinMat } = createMiniPersonMesh(
        Math.random() < 0.5 ? 0x3388ff : 0xff8833
      );
      
      // Random starting position along curve
      const t = Math.random();
      const dir = Math.random() < 0.5 ? 1 : -1;
      const lane = this.laneOffsets[Math.floor(Math.random() * this.laneOffsets.length)];
      
      const pos = this.getPathTarget(t, lane).targetPos;
      
      const agent = {
        // Physics
        pos: pos.clone(),
        vel: new THREE.Vector3(),
        acc: new THREE.Vector3(),
        
        // Walkway navigation
        t: t,
        dir: dir,
        lane: lane,
        laneOffset: lane,
        desiredSpeed: 8 + Math.random() * 1.0,
        maxSpeed: 5.0,
        maxForce: 0.15,
        
        // Rendering
        mesh: mesh,
        parts: parts,
        bodyMat: bodyMat,
        skinMat: skinMat,
      };
      
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.agents.push(agent);
    }
  }
  
  /**
   * Remove n agents
   */
  remove(count) {
    for (let i = 0; i < count && this.agents.length > 0; i++) {
      const agent = this.agents.pop();
      this.scene.remove(agent.mesh);
      // Dispose geometry and materials
      agent.mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
  }
  
  /**
   * Main update loop
   */
  update(dt, time) {
    // Rebuild spatial grid
    this.grid.clear();
    for (const agent of this.agents) {
      this.grid.insert(agent);
    }
    
    // Update each agent
    for (const agent of this.agents) {
      this.stepAgent(agent, dt, time);
    }
  }
  
  /**
   * Step individual agent (steering + physics + animation)
   */
  stepAgent(agent, dt, time) {
    const neighbors = this.grid.query(agent);
    
    // Compute steering forces
    const steer = this.computeSteering(agent, neighbors);
    
    // Apply force
    agent.acc.add(steer);
    
    // Integrate physics
    this.integrate(agent, dt);
    
    // Update spline progress
    this.updateSplineProgress(agent, dt);
    
    // Animate mesh (handles position update internally)
    animateHumanoid(agent, time);
  }
  
  /**
   * Compute steering forces with priority-based arbitration
   */
  computeSteering(agent, neighbors) {
    const force = new THREE.Vector3();
    
    // Get path info
    const pathTarget = this.getPathTarget(agent.t + agent.dir * this.lookAheadT, agent.laneOffset);
    
    // 1. CRITICAL: Containment (prevent falling off platform) - highest priority
    const containForce = this.containmentForce(agent, pathTarget);
    force.add(containForce.multiplyScalar(this.weights.contain));
    
    // 2. HIGH: Separation (avoid crowding)
    const sepForce = this.separationForce(agent, neighbors);
    force.add(sepForce.multiplyScalar(this.weights.sep));
    
    // 3. MEDIUM: Path following (primary navigation)
    const pathForce = this.seekForce(agent, pathTarget.targetPos, 2.0);
    force.add(pathForce.multiplyScalar(this.weights.path));
    
    // 4. LOW: Alignment (flow with neighbors)
    if (this.weights.ali > 0) {
      const aliForce = this.alignmentForce(agent, neighbors);
      force.add(aliForce.multiplyScalar(this.weights.ali));
    }
    
    // 5. LOW: Cohesion (group together)
    if (this.weights.coh > 0) {
      const cohForce = this.cohesionForce(agent, neighbors);
      force.add(cohForce.multiplyScalar(this.weights.coh));
    }
    
    // 6. QUEUEING: Brake if agent ahead
    if (this.weights.queue > 0) {
      const queueForce = this.queueingForce(agent, neighbors, pathTarget.tangent);
      force.add(queueForce.multiplyScalar(this.weights.queue));
    }
    
    // Clamp total force
    return this.clampForce(force, agent.maxForce);
  }
  
  /**
   * Get target position on path at parameter t with lane offset
   */
  getPathTarget(t, laneOffset) {
    t = THREE.MathUtils.clamp(t, 0, 1);
    
    const center = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    
    const targetPos = center.clone().add(normal.multiplyScalar(laneOffset));
    targetPos.y = this.platformHeight + this.yOffset;
    
    return { targetPos, tangent, normal, center };
  }
  
  /**
   * Seek force toward target with arrival
   */
  seekForce(agent, target, slowRadius) {
    const desired = target.clone().sub(agent.pos);
    const dist = desired.length();
    
    if (dist < 0.01) return new THREE.Vector3();
    
    desired.normalize();
    
    // Arrival behavior
    if (dist < slowRadius) {
      desired.multiplyScalar(agent.desiredSpeed * (dist / slowRadius));
    } else {
      desired.multiplyScalar(agent.desiredSpeed);
    }
    
    const steer = desired.sub(agent.vel);
    return steer;
  }
  
  /**
   * Containment force (push back if too far from lane)
   */
  containmentForce(agent, pathTarget) {
    const { center, normal } = pathTarget;
    
    // Calculate lateral distance from center
    const toAgent = agent.pos.clone().sub(center);
    toAgent.y = 0; // project to XZ
    const lateral = toAgent.dot(normal);
    
    const maxLat = this.corridorWidth / 2 - 0.5; // margin
    
    if (Math.abs(lateral) > maxLat) {
      // Push back toward center
      const pushDir = normal.clone().multiplyScalar(-Math.sign(lateral));
      return pushDir.multiplyScalar(2.0);
    }
    
    return new THREE.Vector3();
  }
  
  /**
   * Separation force (avoid nearby agents)
   */
  separationForce(agent, neighbors) {
    const force = new THREE.Vector3();
    let count = 0;
    
    for (const other of neighbors) {
      if (other === agent) continue;
      
      const diff = agent.pos.clone().sub(other.pos);
      diff.y = 0; // ignore vertical
      const dist = diff.length();
      
      if (dist > 0 && dist < this.neighborRadius) {
        diff.normalize();
        diff.divideScalar(dist); // weight by inverse distance
        force.add(diff);
        count++;
      }
    }
    
    if (count > 0) {
      force.divideScalar(count);
      if (force.length() > 0) {
        force.normalize().multiplyScalar(agent.desiredSpeed);
        force.sub(agent.vel);
      }
    }
    
    return force;
  }
  
  /**
   * Alignment force (match neighbor velocities)
   */
  alignmentForce(agent, neighbors) {
    const avgVel = new THREE.Vector3();
    let count = 0;
    
    for (const other of neighbors) {
      if (other === agent) continue;
      const dist = agent.pos.distanceTo(other.pos);
      if (dist > 0 && dist < this.neighborRadius) {
        avgVel.add(other.vel);
        count++;
      }
    }
    
    if (count > 0) {
      avgVel.divideScalar(count);
      avgVel.normalize().multiplyScalar(agent.desiredSpeed);
      const steer = avgVel.sub(agent.vel);
      return steer;
    }
    
    return new THREE.Vector3();
  }
  
  /**
   * Cohesion force (move toward center of neighbors)
   */
  cohesionForce(agent, neighbors) {
    const centerOfMass = new THREE.Vector3();
    let count = 0;
    
    for (const other of neighbors) {
      if (other === agent) continue;
      const dist = agent.pos.distanceTo(other.pos);
      if (dist > 0 && dist < this.neighborRadius) {
        centerOfMass.add(other.pos);
        count++;
      }
    }
    
    if (count > 0) {
      centerOfMass.divideScalar(count);
      const desired = centerOfMass.sub(agent.pos);
      desired.normalize().multiplyScalar(agent.desiredSpeed);
      const steer = desired.sub(agent.vel);
      return steer;
    }
    
    return new THREE.Vector3();
  }
  
  /**
   * Queueing force (brake if agent ahead in path)
   */
  queueingForce(agent, neighbors, tangent) {
    const brakeForce = new THREE.Vector3();
    
    for (const other of neighbors) {
      if (other === agent) continue;
      
      const toOther = other.pos.clone().sub(agent.pos);
      toOther.y = 0;
      const dist = toOther.length();
      
      if (dist > 0 && dist < this.brakeRadius) {
        // Check if other is ahead in direction of travel
        toOther.normalize();
        const ahead = toOther.dot(tangent);
        
        if (ahead > 0.5) {
          // Other is ahead, apply braking
          const brakeMagnitude = (this.brakeRadius - dist) / this.brakeRadius;
          brakeForce.add(agent.vel.clone().multiplyScalar(-brakeMagnitude * 0.5));
        }
      }
    }
    
    return brakeForce;
  }
  
  /**
   * Clamp force magnitude
   */
  clampForce(vec, maxForce) {
    if (vec.length() > maxForce) {
      vec.normalize().multiplyScalar(maxForce);
    }
    return vec;
  }
  
  /**
   * Integrate physics (Euler) with improved clamping
   */
  integrate(agent, dt) {
    // Velocity update
    agent.vel.add(agent.acc.clone().multiplyScalar(dt));
    
    // Clamp speed
    const speed = agent.vel.length();
    if (speed > agent.maxSpeed) {
      agent.vel.normalize().multiplyScalar(agent.maxSpeed);
    }
    
    // Position update
    agent.pos.add(agent.vel.clone().multiplyScalar(dt));
    
    // Reset acceleration
    agent.acc.set(0, 0, 0);
  }
  
  /**
   * Update spline progress based on actual movement
   */
  updateSplineProgress(agent, dt) {
    const tSpeedScale = 0.08; // tunable - how fast agent moves along spline parameter
    const speed = agent.vel.length();
    
    // Move along spline based on actual speed
    agent.t += agent.dir * speed * tSpeedScale * dt;
    
    // Handle end of path (turn around with smooth transition)
    if (agent.t > 1.0) {
      agent.t = 1.0;
      agent.dir = -1;
      // Randomly switch lanes 30% of the time
      if (Math.random() < 0.3) {
        agent.laneOffset = this.laneOffsets[Math.floor(Math.random() * this.laneOffsets.length)];
      }
    } else if (agent.t < 0.0) {
      agent.t = 0.0;
      agent.dir = 1;
      if (Math.random() < 0.3) {
        agent.laneOffset = this.laneOffsets[Math.floor(Math.random() * this.laneOffsets.length)];
      }
    }
  }
}
