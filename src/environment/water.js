
import * as THREE from "three";

function riverCenterX(z, p) {
  return (
    Math.sin((z + p.seedishOffset) / p.riverMeanderWavelength) *
      p.riverMeanderAmp +
    Math.sin((z - p.seedishOffset) / (p.riverMeanderWavelength * 0.55)) *
      (p.riverMeanderAmp * 0.35)
  );
}

export function createWater({

  width = 800,
  length = 800,

  waterLevel = -6,

  samplerParams = {},

  waterHalfWidth = null,

  yOffset = 0.35,

  segmentsLength = 260,
  segmentsWidth = 6,

  color = 0x2a5f9e,
  opacity = 0.38,
  roughness = 0.08,
  clearcoat = 1.0,
  clearcoatRoughness = 0.06,
  transmission = 0.4, 
  thickness = 0.5
} = {}) {

  const p = {
    riverMeanderAmp: 55,
    riverMeanderWavelength: 140,
    riverHalfWidth: 56,
    seedishOffset: 13.37,
    ...samplerParams
  };

  const halfWidth =
    waterHalfWidth !== null ? waterHalfWidth : p.riverHalfWidth * 0.92;
  const ribbonWidth = halfWidth * 2;


  const geo = new THREE.PlaneGeometry(
    ribbonWidth,
    length,
    segmentsWidth,
    segmentsLength
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const z = pos.getZ(i);

    const centerX = riverCenterX(z, p);
    pos.setX(i, centerX + localX);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();


  const mat = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,


    roughness,
    metalness: 0.0,
    clearcoat,
    clearcoatRoughness,

    depthWrite: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "Water";


  mesh.position.y = waterLevel + yOffset;

  function update(_dt) {

  }

  return { mesh, update };
}