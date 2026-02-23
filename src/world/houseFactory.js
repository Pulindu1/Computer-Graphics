import * as THREE from "three";
import { PALETTE } from "./palette.js";


class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  choose(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }
}


const materialCache = new Map();

function getMaterial(key, descriptor) {
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial(descriptor));
  }
  return materialCache.get(key);
}


function createHouseLOD0(seed, config) {
  const rng = new SeededRandom(seed);
  const group = new THREE.Group();


  const bodyW = config.bodyWidth;
  const bodyH = config.bodyHeight;
  const bodyD = config.bodyDepth;


  const wallColors = [
    PALETTE.walls.cream,
    PALETTE.walls.lightGrey,
    PALETTE.walls.brownStone,
    PALETTE.walls.brick,
  ];
  const wallColor = rng.choose(wallColors);
  const wallMat = getMaterial(`wall_${wallColor}`, {
    color: wallColor,
    roughness: 0.7,
    metalness: 0.0,
  });

  const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  const body = new THREE.Mesh(bodyGeo, wallMat);
  body.position.y = bodyH * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof
  const roofChoices = ["gable", "flat"];
  const roofType = rng.choose(roofChoices);

  const roofColors = [PALETTE.roofs.slate, PALETTE.roofs.terracotta, PALETTE.roofs.brown];
  const roofColor = rng.choose(roofColors);
  const roofMat = getMaterial(`roof_${roofColor}`, {
    color: roofColor,
    roughness: 0.75,
    metalness: 0.05,
  });

  if (roofType === "gable") {
    // cone-like roof
    const roofGeo = new THREE.ConeGeometry(bodyW * 0.5, bodyH * 0.6, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = bodyH + bodyH * 0.3;
    roof.rotation.y = Math.PI * 0.25;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
  } else {

    const roofGeo = new THREE.BoxGeometry(bodyW * 1.1, bodyH * 0.15, bodyD * 1.1);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = bodyH + bodyH * 0.075;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
  }

  // Windows
  const windowGlassMat = getMaterial("window", {
    color: PALETTE.windows.glass,
    roughness: 0.1,
    metalness: 0.7,
    emissive: PALETTE.windows.lit,
    emissiveIntensity: 0.3,
  });

  const windowSize = bodyW * 0.24;
  const windowSpacing = bodyW * 0.48;
  const windowRow1Y = bodyH * 0.65;
  const windowRow2Y = bodyH * 0.35;

  for (let i = 0; i < 2; i++) {
    const xPos = -bodyW * 0.25 + i * windowSpacing;

    const win1Geo = new THREE.PlaneGeometry(windowSize, windowSize);
    const win1 = new THREE.Mesh(win1Geo, windowGlassMat);
    win1.position.set(xPos, windowRow1Y, bodyD * 0.5 + 0.05);
    win1.receiveShadow = false;
    group.add(win1);

    // Row 2
    const win2Geo = new THREE.PlaneGeometry(windowSize, windowSize);
    const win2 = new THREE.Mesh(win2Geo, windowGlassMat);
    win2.position.set(xPos, windowRow2Y, bodyD * 0.5 + 0.05);
    win2.receiveShadow = false;
    group.add(win2);
  }

  // Door
  const doorW = bodyW * 0.2;
  const doorH = bodyH * 0.34;
  const doorD = 0.1;
  const doorMat = getMaterial("door", {
    color: PALETTE.doors.brown,
    roughness: 0.6,
    metalness: 0.3,
  });

  const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorD);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, doorH * 0.5, bodyD * 0.5 + 0.1);
  door.castShadow = true;
  door.receiveShadow = true;
  group.add(door);

  return group;
}

// LOD1: simplified (body + roof only)
function createHouseLOD1(seed, config) {
  const rng = new SeededRandom(seed);
  const group = new THREE.Group();

  const bodyW = config.bodyWidth;
  const bodyH = config.bodyHeight;
  const bodyD = config.bodyDepth;

  const wallColors = [
    PALETTE.walls.cream,
    PALETTE.walls.lightGrey,
    PALETTE.walls.brownStone,
    PALETTE.walls.brick,
  ];
  const wallColor = rng.choose(wallColors);
  const wallMat = getMaterial(`wall_${wallColor}`, {
    color: wallColor,
    roughness: 0.7,
    metalness: 0.0,
  });

  // Body
  const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  const body = new THREE.Mesh(bodyGeo, wallMat);
  body.position.y = bodyH * 0.5;
  body.castShadow = false;
  body.receiveShadow = true;
  group.add(body);

  // Roof simplified
  const roofColors = [PALETTE.roofs.slate, PALETTE.roofs.terracotta, PALETTE.roofs.brown];
  const roofColor = rng.choose(roofColors);
  const roofMat = getMaterial(`roof_${roofColor}`, {
    color: roofColor,
    roughness: 0.75,
    metalness: 0.05,
  });

  const roofGeo = new THREE.BoxGeometry(bodyW * 1.1, bodyH * 0.15, bodyD * 1.1);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = bodyH + bodyH * 0.075;
  roof.castShadow = false;
  roof.receiveShadow = true;
  group.add(roof);

  return group;
}

// LOD2
function createHouseLOD2(seed, config) {
  const rng = new SeededRandom(seed);

  const bodyW = config.bodyWidth;
  const bodyH = config.bodyHeight * 1.15;
  const bodyD = config.bodyDepth;

  const wallColors = [
    PALETTE.walls.cream,
    PALETTE.walls.lightGrey,
    PALETTE.walls.brownStone,
    PALETTE.walls.brick,
  ];
  const wallColor = rng.choose(wallColors);
  const wallMat = getMaterial(`wall_${wallColor}`, {
    color: wallColor,
    roughness: 0.7,
    metalness: 0.0,
  });

  const silhouetteGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  const silhouette = new THREE.Mesh(silhouetteGeo, wallMat);
  silhouette.position.y = bodyH * 0.5;
  silhouette.castShadow = false;
  silhouette.receiveShadow = false;

  return silhouette;
}


export function createHouseLOD(seed, config) {
  const lod = new THREE.LOD();

  const lod0 = createHouseLOD0(seed, config);
  const lod1 = createHouseLOD1(seed, config);
  const lod2 = createHouseLOD2(seed, config);

  lod.addLevel(lod0, 0);    // Close: full detail
  lod.addLevel(lod1, 700);  // Mid: simplified
  lod.addLevel(lod2, 2000);  // Far: silhouette

  return lod;
}


export const HOUSE_CONFIG_DEFAULT = {
  bodyWidth: 25,
  bodyHeight: 35,
  bodyDepth: 30,
  plotWidth: 35,
  plotGap: 10,
  setback: 8,
  plotDepth: 15,
};
