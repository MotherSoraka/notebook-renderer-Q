/**
 * Seeded Random Number Generator
 * Provides deterministic randomness for consistent rendering output.
 * 
 * @module core/utils/seed
 */

/**
 * Creates a seeded random number generator using Mulberry32 algorithm.
 * Same seed always produces same sequence of numbers.
 * 
 * @param {number} seed - Integer seed value
 * @returns {function} Function that returns random number in [0, 1)
 */
export function createSeededRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a random number following a Gaussian (normal) distribution.
 * Uses Box-Muller transform.
 * 
 * @param {number} mean - Mean of the distribution
 * @param {number} stdDev - Standard deviation
 * @param {function} rng - Random number generator function (default: Math.random)
 * @returns {number} Random number from Gaussian distribution
 */
export function gaussianRandom(mean = 0, stdDev = 1, rng = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

/**
 * Generates a random integer in range [min, max] (inclusive).
 * 
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {function} rng - Random number generator function
 * @returns {number} Random integer in range
 */
export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Generates a random float in range [min, max).
 * 
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @param {function} rng - Random number generator function
 * @returns {number} Random float in range
 */
export function randomFloat(min, max, rng = Math.random) {
  return rng() * (max - min) + min;
}

/**
 * Creates a deterministic hash from a string (for converting string seeds to numbers).
 * 
 * @param {string} str - Input string
 * @returns {number} 32-bit integer hash
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash >>> 0;
}
