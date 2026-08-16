import * as THREE from "three";
import { createMiniPersonMesh, animateHumanoid } from "../crowd/MiniPersonFactory.js";
import { animateHumanoidLOD } from "../crowd/animationLOD.js";
import { cellCoord, packKey, unpackKey } from "../spatial/hashKey.js";
import { SpatialHashIndex } from "../spatial/SpatialHashIndex.js";
import { QuadtreeIndex } from "../spatial/QuadtreeIndex.js";

class Agent {
  constructor(x, z, groupId, height) {
    this.pos = new THREE.Vector3(x, height, z);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.acc = new THREE.Vector3(0, 0, 0);
    this.groupId = groupId;
    this.isLeader = Math.random() < 0.15;
    this.mesh = null;
    this.parts = null;
    this.bodyMat = null;
    this.mode = 0;
    this.meshHeight = 1.0;
    this.maxSpeed = 0.6;
    this.maxForce = 0.25;
    this.wander = Math.random() * Math.PI * 2;
    this.animationTime = 0;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update(dt, agents, neighbors, bounds, pyramidPos, preferences, lightCubeObstacles = []) {
    const speed = this.vel.length();
    this.mode = speed < 0.15 ? 0 : 1;

    if (this.mode === 1) {
      this.animationTime += dt * 0.5;
    }


    if (this.isLeader) {
      this._applyWanderBehavior(dt, preferences);
    } else {
      this._applyFollowBehavior(agents, preferences);
    }


    this._applyAvoidanceForce(neighbors, preferences);


    this._applyHouseAvoidance(bounds, preferences);


    if (lightCubeObstacles.length > 0) {
      this._applyLightCubeAvoidance(lightCubeObstacles, preferences);
    }

    if (preferences.pyramidAvoidance > 0) {
      this._applyPyramidAvoidance(pyramidPos, preferences);
    }

    if (preferences.pyramidAttraction > 0) {
      this._applyAttractionForce(pyramidPos, preferences);
    }

    this.acc.clampLength(0, this.maxForce);

    this.vel.addScaledVector(this.acc, dt);
    this.vel.clampLength(0, this.maxSpeed);

    this.pos.addScaledVector(this.vel, dt);

    this.pos.y = bounds.baseHeight;
    this.vel.y = 0;

    if (this.pos.x < bounds.minX) this.pos.x = bounds.maxX;
    if (this.pos.x > bounds.maxX) this.pos.x = bounds.minX;
    if (this.pos.z < bounds.minZ) this.pos.z = bounds.maxZ;
    if (this.pos.z > bounds.maxZ) this.pos.z = bounds.minZ;

    if (this.mesh) {
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
      if (this.vel.lengthSq() > 0.01) {
        this.mesh.rotation.y = Math.atan2(this.vel.x, this.vel.z);
      }
    }


    this.acc.multiplyScalar(0);
  }

  _applyWanderBehavior(dt, preferences) {
    this.wander += (Math.random() - 0.5) * 0.5;
    const wanderForce = new THREE.Vector3(
      Math.cos(this.wander) * 0.4,
      0,
      Math.sin(this.wander) * 0.4
    );
    this.applyForce(wanderForce);
  }

  _applyFollowBehavior(agents, preferences) {
    const leader = agents.find(a => a.groupId === this.groupId && a.isLeader);
    if (!leader) return;

    const toLeader = new THREE.Vector3().subVectors(leader.pos, this.pos);
    const dist = toLeader.length();

    if (dist > 0.1) {
      toLeader.normalize();
      toLeader.multiplyScalar((preferences.groupCohesion || 0.3) * 0.5);
      this.applyForce(toLeader);
    }
  }

  _applyAvoidanceForce(neighbors, preferences) {
    if (preferences.avoidPedestrians <= 0) return;

    const avoidance = new THREE.Vector3();

    for (const other of neighbors) {
      if (other === this) continue;
      const toOther = new THREE.Vector3().subVectors(other.pos, this.pos);
      const dist = toOther.length();
      if (dist < 1.5 && dist > 0.1) {
        const away = new THREE.Vector3().subVectors(this.pos, other.pos).normalize();
        away.multiplyScalar((1.5 - dist) / 1.5);
        avoidance.add(away);
      }
    }

    if (avoidance.length() > 0.1) {
      avoidance.normalize().multiplyScalar(preferences.avoidPedestrians);
      this.applyForce(avoidance);
    }
  }

  _applyHouseAvoidance(bounds, preferences) {
    if (preferences.avoidHouses <= 0) return;

    const houseRects = bounds.houses || [];
    const avoidance = new THREE.Vector3();

    for (const rect of houseRects) {
      const closest = new THREE.Vector3(
        Math.max(rect.minX, Math.min(this.pos.x, rect.maxX)),
        0,
        Math.max(rect.minZ, Math.min(this.pos.z, rect.maxZ))
      );

      const toClosest = new THREE.Vector3().subVectors(this.pos, closest);
      const dist = toClosest.length();

      if (dist < 8) {  // Strict avoidance zone: 8 units
        toClosest.normalize();
        toClosest.multiplyScalar((8 - dist) / 8 * preferences.avoidHouses * 1.5);  // Stronger force
        avoidance.add(toClosest);
      }
    }

    if (avoidance.length() > 0.1) {
      this.applyForce(avoidance);
    }
  }

  _applyPyramidAvoidance(pyramidPos, preferences) {
    const toPyramid = new THREE.Vector3().subVectors(pyramidPos, this.pos);
    const dist = toPyramid.length();

    if (dist < 25) {
      const away = new THREE.Vector3().subVectors(this.pos, pyramidPos).normalize();
      away.multiplyScalar((25 - dist) / 25 * preferences.pyramidAvoidance * 2.0);
      this.applyForce(away);
    }
  }

  _applyLightCubeAvoidance(obstacles, preferences) {
    if (!obstacles || obstacles.length === 0) return;

    for (const obstacle of obstacles) {
      const toObstacle = new THREE.Vector3().subVectors(obstacle.position, this.pos);
      const dist = toObstacle.length();
      const avoidDist = obstacle.radius + 3;

      if (dist < avoidDist) {
        const away = new THREE.Vector3().subVectors(this.pos, obstacle.position).normalize();
        away.multiplyScalar((avoidDist - dist) / avoidDist * 1.5);
        this.applyForce(away);
      }
    }
  }

  _applyAttractionForce(pyramidPos, preferences) {
    const toAttraction = new THREE.Vector3(
      pyramidPos.x - this.pos.x,
      0,
      pyramidPos.z - this.pos.z
    );
    const dist = toAttraction.length();

    if (dist > 5 && dist < 50) {
      toAttraction.normalize();
      toAttraction.multiplyScalar(preferences.pyramidAttraction * 0.08);
      this.applyForce(toAttraction);
    }
  }
}

class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.map = new Map();
    this.tmpOut = [];
  }

  clear() {
    for (const bucket of this.map.values()) {
      bucket.length = 0;
    }
  }

  insert(agent) {
    const cx = cellCoord(agent.pos.x, this.cellSize);
    const cz = cellCoord(agent.pos.z, this.cellSize);
    const key = packKey(cx, cz);

    if (!this.map.has(key)) {
      this.map.set(key, []);
    }
    this.map.get(key).push(agent);
  }


  getNearInto(x, z, radius, out) {
    out.length = 0;
    const rCells = Math.ceil(radius / this.cellSize);
    const cx0 = cellCoord(x, this.cellSize);
    const cz0 = cellCoord(z, this.cellSize);

    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const key = packKey(cx0 + dx, cz0 + dz);
        const bucket = this.map.get(key);
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            out.push(bucket[i]);
          }
        }
      }
    }
    return out;
  }


  getNear(x, z, radius) {
    return this.getNearInto(x, z, radius, this.tmpOut);
  }
}

export class StreetPedestrians {
  constructor({ scene, street, pyramid, params = {} }) {
    this.scene = scene;
    this.street = street;
    this.pyramid = pyramid;

    this.params = {
      population: params.population ?? 20,
      groupCohesion: params.groupCohesion ?? 0.3,
      avoidPedestrians: params.avoidPedestrians ?? 0.6,
      avoidHouses: params.avoidHouses ?? 0.5,
      pyramidAttraction: params.pyramidAttraction ?? 0.15,
      pyramidAvoidance: params.pyramidAvoidance ?? 0.3,
      enabled: params.enabled ?? true,
    };

    console.log("[StreetPedestrians] Constructor called with params:", this.params);

    this.agents = [];
    // Pluggable spatial index — default hash, swappable to quadtree at runtime
    this.spatialIndexMode = "hash"; // "hash" | "quadtree"
    this._streetBounds = () => ({
      minX: this.street.centerX - this.street.width  * 0.5 - 10,
      minZ: this.street.centerZ - this.street.length * 0.5 - 10,
      maxX: this.street.centerX + this.street.width  * 0.5 + 10,
      maxZ: this.street.centerZ + this.street.length * 0.5 + 10,
    });
    this._hashIndex = new SpatialHashIndex(6);
    this._qtIndex   = new QuadtreeIndex(this._streetBounds(), { capacity: 8, maxDepth: 10 });
    this.spatialHash = this._hashIndex;
    // Expose spatial stats for debug overlay
    this.spatialStats = this.spatialHash.stats;
    this.root = new THREE.Group();
    this.root.name = "StreetPedestrians";
    scene.add(this.root);

    // Animation LOD system
    this.camera = null;
    this.animLodEnabled = true;
    this.animLodParams = {
      NEAR_IN_SQ: 15 * 15,   // 15m
      NEAR_OUT_SQ: 25 * 25,  // 25m
      MID_IN_SQ: 25 * 25,    // 25m
      MID_OUT_SQ: 60 * 60,   // 60m
      MID_RATE: 4,           // Every 4 frames
    };

    this._groupLifespans = new Map();
    this._build();
  }

  setCamera(camera) {
    this.camera = camera;
  }

  setAnimationLODEnabled(enabled) {
    this.animLodEnabled = enabled;
  }

  setAnimationLODParams(params) {
    this.animLodParams = { ...this.animLodParams, ...params };
  }

  /** Switch between "hash" and "quadtree" at runtime */
  setSpatialIndexMode(mode) {
    this.spatialIndexMode = mode;
    if (mode === "quadtree") {
      this._qtIndex.setBounds(this._streetBounds());
    }
    this.spatialHash = mode === "quadtree" ? this._qtIndex : this._hashIndex;
    this.spatialStats = this.spatialHash.stats;
  }

  _build() {
    // Spawn initial population
    this._respawnAgents();
  }

  _respawnAgents() {
    // Clear old agents and properly dispose meshes
    for (const agent of this.agents) {
      if (agent.mesh) {
        // Remove mesh from scene
        if (agent.mesh.parent) {
          agent.mesh.parent.remove(agent.mesh);
        }
        
        // Dispose all geometries
        if (agent.geometries && agent.geometries.length > 0) {
          for (const geo of agent.geometries) {
            if (geo && geo.dispose) {
              geo.dispose();
            }
          }
        }
        
        // Dispose all materials
        if (agent.materials && agent.materials.length > 0) {
          for (const mat of agent.materials) {
            if (mat && mat.dispose) {
              mat.dispose();
            }
          }
        }
        
        // Clear all references
        agent.mesh = null;
        agent.parts = null;
        agent.geometries = null;
        agent.materials = null;
      }
    }
    this.agents = [];
    this._groupLifespans.clear();

    console.log("[StreetPedestrians] Respawning", this.params.population, "agents");

    // Spawn new agents with better spread
    const usedPositions = new Set();
    const minDistance = 3; // Minimum distance between spawn points
    
    for (let i = 0; i < this.params.population; i++) {
      let x, z, key;
      let attempts = 0;
      const maxAttempts = 50;
      
      // Keep trying to find a unique spawn position
      do {
        x = this.street.centerX + (Math.random() - 0.5) * this.street.width * 0.85;
        z = this.street.centerZ + (Math.random() - 0.5) * this.street.length * 0.95;
        key = Math.round(x / minDistance) + ',' + Math.round(z / minDistance);
        attempts++;
      } while (usedPositions.has(key) && attempts < maxAttempts);
      
      if (attempts >= maxAttempts) continue; // Skip this agent if we can't find a spot
      
      usedPositions.add(key);
      const agent = new Agent(x, z, Math.floor(i / 3), this.street.height);

      // Create humanoid mesh
      const result = createMiniPersonMesh(0xff69b4);  // Soft pink
      agent.mesh = result.mesh;
      agent.parts = result.parts;
      
      // Store both geometries and materials for proper disposal
      agent.geometries = result.geometries || [];
      agent.materials = result.materials || [];
      
      // Ensure clean mesh setup
      agent.mesh.position.set(agent.pos.x, agent.pos.y, agent.pos.z);
      agent.mesh.castShadow = true;
      agent.mesh.receiveShadow = true;
      
      // Add to root
      this.root.add(agent.mesh);

      this.agents.push(agent);

      // Track group creation time
      if (!this._groupLifespans.has(agent.groupId)) {
        this._groupLifespans.set(agent.groupId, Date.now());
      }
    }
    console.log("[StreetPedestrians] Successfully spawned", this.agents.length, "agents");
  }

  update(dt, pyramidPos, houseRects, lightCubeObstacles = []) {
    if (!this.params.enabled || this.agents.length === 0) return;

    // Rebuild spatial index (hash or quadtree)
    this.spatialHash = this.spatialIndexMode === "quadtree" ? this._qtIndex : this._hashIndex;
    this.spatialStats = this.spatialHash.stats;
    this.spatialHash.clear();
    for (const agent of this.agents) {
      this.spatialHash.insert(agent);
    }

    // Preallocated temp array for all neighbor queries
    const tmpNeighbors = [];

    // Bounds for wrapping/avoidance
    const bounds = {
      minX: this.street.centerX - this.street.width * 0.5,
      maxX: this.street.centerX + this.street.width * 0.5,
      minZ: this.street.centerZ - this.street.length * 0.5,
      maxZ: this.street.centerZ + this.street.length * 0.5,
      baseHeight: this.street.height,
      houses: houseRects || [],
    };

    // Update each agent
    for (const agent of this.agents) {
      this.spatialHash.queryInto(agent.pos.x, agent.pos.z, 3, tmpNeighbors);
      agent.update(dt, this.agents, tmpNeighbors, bounds, pyramidPos, this.params, lightCubeObstacles);

      // Animate humanoid walk cycle using LOD
      if (agent.mesh && agent.parts) {
        if (this.camera && this.animLodEnabled) {
          animateHumanoidLOD(agent, agent.animationTime, this.camera.position, this.animLodParams, this.animLodEnabled);
        } else {
          animateHumanoid(agent, agent.animationTime);
        }
      }
    }

    // Rebalance groups
    const now = Date.now();
    for (const [groupId, createdAt] of this._groupLifespans.entries()) {
      if (now - createdAt > (Math.random() * 20000 + 10000)) {  // 10-30 seconds
        // Reassign group members
        for (const agent of this.agents) {
          if (agent.groupId === groupId && !agent.isLeader) {
            agent.groupId = Math.floor(Math.random() * Math.ceil(this.params.population / 3));
          }
        }
        this._groupLifespans.set(groupId, now);
      }
    }
  }

  setPopulation(count) {
    console.log("[StreetPedestrians] setPopulation called with:", count);
    this.params.population = Math.max(0, Math.min(100, count));  // Clamp 0-100
    console.log("[StreetPedestrians] Respawning with population:", this.params.population);
    this._respawnAgents();
    console.log("[StreetPedestrians] Current agent count:", this.agents.length);
  }

  setPreference(key, value) {
    if (key in this.params) {
      this.params[key] = Math.max(0, Math.min(1, value));  // Clamp 0-1
    }
  }

  setEnabled(enabled) {
    this.params.enabled = enabled;
    this.root.visible = enabled;
  }

  dispose() {
    this.scene.remove(this.root);
    for (const agent of this.agents) {
      if (agent.mesh) {
        agent.mesh.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    }
  }
}
