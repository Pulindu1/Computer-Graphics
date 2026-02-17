// Shared colour palette for procedural world generation
// Keeping consistent aesthetic across street district

export const PALETTE = {
  // Street surfaces
  street: {
    grey: 0x777777,
    darkGrey: 0x555555,
    concrete: 0x888888,
    asphalt: 0x444444,
  },

  // Sidewalks
  sidewalk: {
    tan: 0xAA9966,
    grey: 0x999999,
  },

  // Building walls
  walls: {
    cream: 0xE8D7C3,
    lightGrey: 0xD0D0D0,
    brownStone: 0x8B7355,
    brick: 0xB85C3C,
    tan: 0xDEB887,
    pale: 0xF0EAD6,
  },

  // Roofs
  roofs: {
    darkRed: 0x8B3A1F,
    slate: 0x556B7F,
    brown: 0x654321,
    black: 0x222222,
    terracotta: 0xC34A36,
  },

  // Windows
  windows: {
    glass: 0x333366,
    lit: 0xFFFF88,
    dark: 0x111122,
  },

  // Doors
  doors: {
    brown: 0x654321,
    darkBrown: 0x3B2F1F,
    blue: 0x2C3E7F,
  },

  // Accents
  accents: {
    wood: 0x8B6F47,
    trim: 0xEDDCC4,
    shadow: 0x444444,
  },
};

// Material presets (reusable, no per-frame allocation)
export function createMaterialLibrary(textureLoader = null) {
  return {
    street: new THREE.MeshStandardMaterial({
      color: PALETTE.street.grey,
      roughness: 0.9,
      metalness: 0.0,
    }),

    sidewalk: new THREE.MeshStandardMaterial({
      color: PALETTE.sidewalk.tan,
      roughness: 0.85,
      metalness: 0.0,
    }),

    wallCream: new THREE.MeshStandardMaterial({
      color: PALETTE.walls.cream,
      roughness: 0.7,
      metalness: 0.0,
    }),

    wallBrick: new THREE.MeshStandardMaterial({
      color: PALETTE.walls.brick,
      roughness: 0.8,
      metalness: 0.0,
    }),

    roofSlate: new THREE.MeshStandardMaterial({
      color: PALETTE.roofs.slate,
      roughness: 0.75,
      metalness: 0.05,
    }),

    roofTerracotta: new THREE.MeshStandardMaterial({
      color: PALETTE.roofs.terracotta,
      roughness: 0.7,
      metalness: 0.0,
    }),

    windowGlass: new THREE.MeshStandardMaterial({
      color: PALETTE.windows.glass,
      roughness: 0.1,
      metalness: 0.7,
      emissive: PALETTE.windows.glass,
      emissiveIntensity: 0.2,
    }),

    door: new THREE.MeshStandardMaterial({
      color: PALETTE.doors.brown,
      roughness: 0.6,
      metalness: 0.3,
    }),

    trim: new THREE.MeshStandardMaterial({
      color: PALETTE.accents.trim,
      roughness: 0.6,
      metalness: 0.1,
    }),
  };
}
