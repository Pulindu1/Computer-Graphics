// 📄 src/crowd/CrowdZoneWalkway.js
import * as THREE from "three";
import { createMiniPersonMesh, animateHumanoid } from "./MiniPersonFactory.js";
import { SpatialHashGrid } from "./SpatialHashGrid.js";

// ── Speed modes ──────────────────────────────────────────────
const MODE_IDLE = 0;
const MODE_WALK = 1;
const MODE_FAST = 2;

const MODE_SPEEDS  = [0, 0.01, 0.05];  // Much slower: stationary, slow walk, brisk walk
const MODE_LABELS  = ["idle", "walk", "fast"];

/**
 * Manages a crowd of agents on a walkway with:
 *  - Free roaming (random wander within corridor)
 *  - Flocking (separation, alignment, cohesion)
 *  - Hard collision avoidance (body radius)
 *  - Speed modes (stationary / walking / fast walking)
 *  - Hard path containment
 */
export class WalkwayZone {
  constructor({
    scene,
    curve,
    corridorWidth = 6.0,
    laneOffsets = [-2, 0, 2],
    yOffset = 0.12,
    lookAheadT = 0.01,
    neighborRadius = 5.0,
    brakeRadius = 3.0,
    platformHeight = -0.8,
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

    // Hard-collision body radius (at 12× scale, person is ~3.6 wide)
    this.bodyRadius = 1.4;

    this.agents = [];
    this.grid = new SpatialHashGrid(neighborRadius);

    // Tunable weights (exposed to UI)
    this.weights = {
      wander:  0.8,
      sep:     3.0,
      ali:     0.3,
      coh:     0.2,
      queue:   1.0,
    };
  }

  // ─────────────────────────── spawn / remove ──────────────────────────
  spawn(count) {
    const palette = [0x3388ff, 0xff8833, 0x33aa55, 0xcc4444, 0x8855cc, 0xddaa33];

    for (let i = 0; i < count; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const { mesh, parts, bodyMat, skinMat } = createMiniPersonMesh(color);

      const t          = Math.random();
      const laneOffset = (Math.random() - 0.5) * (this.corridorWidth - 2);
      const pos        = this.getPathTarget(t, laneOffset).targetPos;

      // Pick an initial speed mode
      const mode = Math.random() < 0.15 ? MODE_IDLE
                 : Math.random() < 0.70 ? MODE_WALK
                 : MODE_FAST;

      const agent = {
        // Physics
        pos:  pos.clone(),
        vel:  new THREE.Vector3(),
        acc:  new THREE.Vector3(),

        // Navigation
        t:          t,
        dir:        Math.random() < 0.5 ? 1 : -1,
        laneOffset: laneOffset,

        // Speed-mode state machine
        mode:         mode,
        desiredSpeed: MODE_SPEEDS[mode],
        maxSpeed:     1.0,  // Much lower max speed
        maxForce:     0.08,
        modeTimer:    200 + Math.random() * 400, // frames until next mode change

        // Wander state
        wanderAngle: Math.random() * Math.PI * 2,

        // Rendering
        mesh, parts, bodyMat, skinMat,
      };

      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.agents.push(agent);
    }
  }

  remove(count) {
    for (let i = 0; i < count && this.agents.length > 0; i++) {
      const agent = this.agents.pop();
      this.scene.remove(agent.mesh);
      agent.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
  }

  // ─────────────────────────── update loop ──────────────────────────
  update(dt, time) {
    // Rebuild spatial hash
    this.grid.clear();
    for (const a of this.agents) this.grid.insert(a);

    for (const a of this.agents) this.stepAgent(a, dt, time);
  }

  stepAgent(agent, dt, time) {
    // 1. Maybe switch speed mode
    this.updateMode(agent);

    // 2. Gather neighbors
    const neighbors = this.grid.query(agent);

    // 3. Steering
    const steer = this.computeSteering(agent, neighbors);
    agent.acc.add(steer);

    // 4. Integrate physics
    this.integrate(agent, dt);

    // 5. Hard collision push (prevent body overlap)
    this.resolveCollisions(agent, neighbors);

    // 6. Hard corridor clamp
    this.clampToPath(agent);

    // 7. Sync spline parameter from position
    this.syncSplineProgress(agent);

    // 8. Animate humanoid mesh
    animateHumanoid(agent, time);
  }

  // ───────────────── speed-mode state machine ─────────────────
  updateMode(agent) {
    agent.modeTimer--;
    if (agent.modeTimer > 0) return;

    const roll = Math.random();
    if (roll < 0.15) {
      agent.mode      = MODE_IDLE;
      agent.modeTimer = 120 + Math.random() * 300;   // idle a bit longer
    } else if (roll < 0.75) {
      agent.mode      = MODE_WALK;
      agent.modeTimer = 200 + Math.random() * 500;
    } else {
      agent.mode      = MODE_FAST;
      agent.modeTimer = 100 + Math.random() * 200;
    }
    agent.desiredSpeed = MODE_SPEEDS[agent.mode];

    // Occasionally reverse direction
    if (Math.random() < 0.3) agent.dir *= -1;
  }

  // ────────────────── combined steering ──────────────────
  computeSteering(agent, neighbors) {
    const force = new THREE.Vector3();
    const pathInfo = this.getPathTarget(agent.t, 0);

    // Separation – strongest, prevents overlap
    const sep = this.separationForce(agent, neighbors);
    force.add(sep.multiplyScalar(this.weights.sep));

    // Wander – random roaming along/across path
    if (agent.mode !== MODE_IDLE) {
      const wan = this.wanderForce(agent, pathInfo);
      force.add(wan.multiplyScalar(this.weights.wander));
    }

    // Alignment
    if (this.weights.ali > 0) {
      const ali = this.alignmentForce(agent, neighbors);
      force.add(ali.multiplyScalar(this.weights.ali));
    }

    // Cohesion
    if (this.weights.coh > 0) {
      const coh = this.cohesionForce(agent, neighbors);
      force.add(coh.multiplyScalar(this.weights.coh));
    }

    // Queueing – brake behind someone
    if (this.weights.queue > 0 && agent.mode !== MODE_IDLE) {
      const q = this.queueingForce(agent, neighbors, pathInfo.tangent);
      force.add(q.multiplyScalar(this.weights.queue));
    }

    return this.clampForce(force, agent.maxForce);
  }

  // ────────────────── wander ──────────────────
  wanderForce(agent, pathInfo) {
    const { tangent, normal } = pathInfo;

    // More aggressive wander angle evolution for truly random movement
    agent.wanderAngle += (Math.random() - 0.5) * 0.8;

    // Reduce rigid path-following, add more freedom
    // Forward component with some randomness
    const forwardBias = agent.dir * (0.5 + Math.random() * 0.5);
    const forward = tangent.clone().multiplyScalar(forwardBias);

    // Stronger lateral wander for more organic, less predictable movement
    const lateral = normal.clone().multiplyScalar(Math.sin(agent.wanderAngle) * 0.8);

    const desired = forward.add(lateral).normalize().multiplyScalar(agent.desiredSpeed);
    return desired.sub(agent.vel);
  }

  // ────────────────── separation ──────────────────
  separationForce(agent, neighbors) {
    const force = new THREE.Vector3();
    const minDist = this.bodyRadius * 2;
    let count = 0;

    for (const other of neighbors) {
      if (other === agent) continue;

      const diff = agent.pos.clone().sub(other.pos);
      diff.y = 0;
      const dist = diff.length();
      if (dist < 0.01 || dist >= this.neighborRadius) continue;

      // Much stronger push when bodies overlap
      const strength = dist < minDist
        ? ((minDist - dist) / minDist) * 4.0   // overlap → big push
        : 1.0 / (dist * dist);                  // further → gentle

      diff.normalize().multiplyScalar(strength);
      force.add(diff);
      count++;
    }

    if (count > 0) force.divideScalar(count);
    return force;
  }

  // ────────────────── alignment ──────────────────
  alignmentForce(agent, neighbors) {
    const avg = new THREE.Vector3();
    let count = 0;

    for (const other of neighbors) {
      if (other === agent) continue;
      const d = agent.pos.distanceTo(other.pos);
      if (d > 0 && d < this.neighborRadius) { avg.add(other.vel); count++; }
    }

    if (count > 0) {
      avg.divideScalar(count);
      if (avg.length() > 0.01) {
        avg.normalize().multiplyScalar(agent.desiredSpeed);
        return avg.sub(agent.vel);
      }
    }
    return new THREE.Vector3();
  }

  // ────────────────── cohesion ──────────────────
  cohesionForce(agent, neighbors) {
    const com = new THREE.Vector3();
    let count = 0;

    for (const other of neighbors) {
      if (other === agent) continue;
      const d = agent.pos.distanceTo(other.pos);
      if (d > 0 && d < this.neighborRadius) { com.add(other.pos); count++; }
    }

    if (count > 0) {
      com.divideScalar(count).sub(agent.pos);
      if (com.length() > 0.01) {
        com.normalize().multiplyScalar(agent.desiredSpeed);
        return com.sub(agent.vel);
      }
    }
    return new THREE.Vector3();
  }

  // ────────────────── queueing ──────────────────
  queueingForce(agent, neighbors, tangent) {
    const brake = new THREE.Vector3();
    const moveDir = tangent.clone().multiplyScalar(agent.dir);

    for (const other of neighbors) {
      if (other === agent) continue;
      const toO = other.pos.clone().sub(agent.pos);
      toO.y = 0;
      const dist = toO.length();
      if (dist < 0.01 || dist >= this.brakeRadius) continue;

      toO.normalize();
      if (toO.dot(moveDir) > 0.3) {
        const mag = (this.brakeRadius - dist) / this.brakeRadius;
        brake.add(agent.vel.clone().multiplyScalar(-mag * 0.6));
      }
    }
    return brake;
  }

  // ────────────────── hard collision resolution ──────────────────
  resolveCollisions(agent, neighbors) {
    const minDist = this.bodyRadius * 2;

    for (const other of neighbors) {
      if (other === agent) continue;
      const diff = agent.pos.clone().sub(other.pos);
      diff.y = 0;
      const dist = diff.length();

      if (dist > 0.01 && dist < minDist) {
        const overlap = minDist - dist;
        const push = diff.normalize().multiplyScalar(overlap * 0.5);
        agent.pos.add(push);
      }
    }
  }

  // ────────────────── path helpers ──────────────────
  getPathTarget(t, laneOffset) {
    t = THREE.MathUtils.clamp(t, 0, 1);

    const center  = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t).normalize();
    const normal  = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const targetPos = center.clone().add(normal.clone().multiplyScalar(laneOffset));
    targetPos.y = this.platformHeight + this.yOffset;

    return { targetPos, tangent, normal: normal.clone(), center };
  }

  clampToPath(agent) {
    const { center, normal, tangent } = this.getPathTarget(agent.t, 0);

    const toAgent = agent.pos.clone().sub(center);
    toAgent.y = 0;
    const lateral = toAgent.dot(normal);

    const maxLat = this.corridorWidth / 2 - 0.2;
    const clamped = THREE.MathUtils.clamp(lateral, -maxLat, maxLat);

    // Reconstruct position
    agent.pos.copy(center);
    agent.pos.add(normal.clone().multiplyScalar(clamped));
    agent.pos.y = this.platformHeight + this.yOffset;

    // If we hit the edge, redirect velocity along path
    if (Math.abs(lateral) > maxLat) {
      const along = agent.vel.dot(tangent);
      agent.vel.copy(tangent).multiplyScalar(along * 0.7);
    }
  }

  // ────────────────── physics ──────────────────
  clampForce(v, max) {
    if (v.length() > max) v.normalize().multiplyScalar(max);
    return v;
  }

  integrate(agent, dt) {
    agent.vel.add(agent.acc.clone().multiplyScalar(dt));

    // Extra drag when idle so agents actually stop
    if (agent.mode === MODE_IDLE) agent.vel.multiplyScalar(0.9);

    const speed = agent.vel.length();
    if (speed > agent.maxSpeed) agent.vel.normalize().multiplyScalar(agent.maxSpeed);

    agent.pos.add(agent.vel.clone().multiplyScalar(dt));
    agent.acc.set(0, 0, 0);
  }

  // ── Sync spline t from world-space velocity ──
  syncSplineProgress(agent) {
    const { tangent } = this.getPathTarget(agent.t, 0);
    const along = agent.vel.dot(tangent);

    const tScale = 0.003;          // slow parameter change
    agent.t += along * tScale;

    // Bounce at ends
    if (agent.t > 0.98) { agent.t = 0.98; agent.dir = -1; }
    else if (agent.t < 0.02) { agent.t = 0.02; agent.dir = 1; }
  }
}
