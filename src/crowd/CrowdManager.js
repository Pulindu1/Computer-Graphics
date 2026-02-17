// 📄 src/crowd/CrowdManager.js

/**
 * Manages multiple crowd zones (walkways, plazas, etc.)
 */
export class CrowdManager {
  constructor() {
    this.zones = [];
    this.stats = {
      totalAgents: 0,
      totalQueries: 0,
      avgNeighborsPerQuery: 0,
    };
  }

  addZone(zone) {
    this.zones.push(zone);
  }

  removeZone(zone) {
    const index = this.zones.indexOf(zone);
    if (index !== -1) {
      this.zones.splice(index, 1);
    }
  }

  update(dt, time) {
    for (const zone of this.zones) {
      zone.update(dt, time);
    }

    // Aggregate stats
    this.stats.totalAgents = 0;
    this.stats.totalQueries = 0;
    this.stats.avgNeighborsPerQuery = 0;

    for (const zone of this.zones) {
      this.stats.totalAgents += zone.stats.agentCount;
      this.stats.totalQueries += zone.stats.queriesThisFrame;
      this.stats.avgNeighborsPerQuery += zone.stats.avgNeighborsFound * zone.agents.length;
    }

    if (this.stats.totalAgents > 0) {
      this.stats.avgNeighborsPerQuery /= this.stats.totalAgents;
    }
  }

  getAgentCount() {
    return this.zones.reduce((sum, zone) => sum + zone.agents.length, 0);
  }

  spawnInZone(zoneIndex, count, isLeader = false) {
    if (zoneIndex >= 0 && zoneIndex < this.zones.length) {
      this.zones[zoneIndex].spawn(count, isLeader);
    }
  }

  removeFromZone(zoneIndex, count) {
    if (zoneIndex >= 0 && zoneIndex < this.zones.length) {
      this.zones[zoneIndex].remove(count);
    }
  }

  // Spawn leaders (1-3 per zone)
  spawnLeaders(zoneIndex, count = 1) {
    this.spawnInZone(zoneIndex, count, true);
  }

  // Toggle features globally
  setFeature(featureName, enabled) {
    for (const zone of this.zones) {
      if (featureName === "flowField") zone.enableFlowField = enabled;
      else if (featureName === "lanes") zone.enableLanes = enabled;
      else if (featureName === "priority") zone.enablePriority = enabled;
    }
  }

  // Update weights globally
  setWeights(weights) {
    for (const zone of this.zones) {
      Object.assign(zone.weights, weights);
    }
  }
}
