// 📄 src/crowd/CrowdManager.js

/**
 * Manages multiple crowd zones (walkways, plazas, etc.)
 */
export class CrowdManager {
  constructor() {
    this.zones = [];
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
  }
  
  getAgentCount() {
    return this.zones.reduce((sum, zone) => sum + zone.agents.length, 0);
  }
  
  spawnInZone(zoneIndex, count) {
    if (zoneIndex >= 0 && zoneIndex < this.zones.length) {
      this.zones[zoneIndex].spawn(count);
    }
  }
  
  removeFromZone(zoneIndex, count) {
    if (zoneIndex >= 0 && zoneIndex < this.zones.length) {
      this.zones[zoneIndex].remove(count);
    }
  }
}
