/**
 * @param {boolean} condition
 * @param {string=} message
 * @returns {asserts condition}
 */

export function assert(condition, message) {
  if (condition) {
    return
  }

  throw new Error(message || 'Assertion failed')
}
