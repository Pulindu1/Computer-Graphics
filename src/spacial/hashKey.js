// 📄 src/spacial/hashKey.js
/**
 * Shared spatial hash key utilities.
 * Allocation-free integer key packing for 2D grid coordinates.
 * Matches the key scheme used in orbSwarm/SpatialHash.
 */

/**
 * Convert world coordinate to grid cell coordinate
 * @param {number} x - World x or z coordinate
 * @param {number} cellSize - Size of each grid cell
 * @returns {number} Cell coordinate
 */
export function cellCoord(x, cellSize) {
  return Math.floor(x / cellSize);
}

/**
 * Pack 2D grid coordinates into a single 32-bit integer key.
 * Allocation-free: no strings, no garbage.
 * 
 * Scheme:
 *   - Add 32768 to offset negative coords into positive range
 *   - Clamp to 16-bit unsigned (0xFFFF = 65535)
 *   - Pack cx into upper 16 bits, cz into lower 16 bits
 * 
 * @param {number} cx - Cell x coordinate (can be negative)
 * @param {number} cz - Cell z coordinate (can be negative)
 * @returns {number} 32-bit packed key
 */
export function packKey(cx, cz) {
  return (((cx + 32768) & 0xFFFF) << 16) | ((cz + 32768) & 0xFFFF);
}

/**
 * Unpack a 32-bit key back into cell coordinates
 * @param {number} key - 32-bit packed key
 * @returns {{cx: number, cz: number}} Unpacked coordinates
 */
export function unpackKey(key) {
  const cx = ((key >> 16) & 0xFFFF) - 32768;
  const cz = (key & 0xFFFF) - 32768;
  return { cx, cz };
}
