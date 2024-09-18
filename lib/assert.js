/**
 * @param {boolean} condition
 * @param {string=} message
 * @returns {asserts condition}
 */
/* c8 ignore start */
export function assert(condition, message) {
  if (condition) {
    return
  }

  throw new Error(message || 'Assertion failed')
}
/* c8 ignore stop */
