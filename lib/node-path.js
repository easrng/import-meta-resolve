/* eslint-disable capitalized-comments */
import {validateString} from './errors.js'
import {CHAR_DOT, CHAR_FORWARD_SLASH} from './utils.js'

/**
 * Resolves . and .. elements in a path with directory names
 * @param {string} path
 * @param {boolean} allowAboveRoot
 * @param {string} separator
 * @param {(_: number) => boolean} isPathSeparator
 */
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
  let result = ''
  let lastSegmentLength = 0
  let lastSlash = -1
  let dots = 0
  let code = 0
  for (let i = 0; i <= path.length; ++i) {
    // eslint-disable-next-line unicorn/prefer-code-point
    if (i < path.length) code = path.charCodeAt(i)
    else if (isPathSeparator(code)) break
    else code = CHAR_FORWARD_SLASH

    if (isPathSeparator(code)) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (dots === 2) {
        if (
          result.length < 2 ||
          lastSegmentLength !== 2 ||
          // eslint-disable-next-line unicorn/prefer-code-point
          result.charCodeAt(result.length - 1) !== CHAR_DOT ||
          // eslint-disable-next-line unicorn/prefer-code-point
          result.charCodeAt(result.length - 2) !== CHAR_DOT
        ) {
          if (result.length > 2) {
            const lastSlashIndex = result.lastIndexOf(separator)
            if (lastSlashIndex === -1) {
              result = ''
              lastSegmentLength = 0
            } else {
              result = result.slice(0, lastSlashIndex)
              lastSegmentLength =
                result.length - 1 - result.lastIndexOf(separator)
            }

            lastSlash = i
            dots = 0
            continue
          } else if (result.length > 0) {
            result = ''
            lastSegmentLength = 0
            lastSlash = i
            dots = 0
            continue
          }
        }

        if (allowAboveRoot) {
          result += result.length > 0 ? `${separator}..` : '..'
          lastSegmentLength = 2
        }
      } else {
        if (result.length > 0)
          result += `${separator}${path.slice(lastSlash + 1, i)}`
        else result = path.slice(lastSlash + 1, i)
        lastSegmentLength = i - lastSlash - 1
      }

      lastSlash = i
      dots = 0
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots
    } else {
      dots = -1
    }
  }

  return result
}

/**
 * @param {number} code
 */
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH
}

function posixCwd() {
  return '/'
}

const path = {
  sep: '/',
  /**
   * path.resolve([from ...], to)
   * @param {...string} arguments_
   * @returns {string}
   */
  resolve(...arguments_) {
    let resolvedPath = ''
    let resolvedAbsolute = false

    for (let i = arguments_.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const path = i >= 0 ? arguments_[i] : posixCwd()
      validateString(path, `paths[${i}]`)

      // Skip empty entries
      if (path.length === 0) {
        continue
      }

      resolvedPath = `${path}/${resolvedPath}`
      // eslint-disable-next-line unicorn/prefer-code-point
      resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeString(
      resolvedPath,
      !resolvedAbsolute,
      '/',
      isPosixPathSeparator
    )

    if (resolvedAbsolute) {
      return `/${resolvedPath}`
    }

    return resolvedPath.length > 0 ? resolvedPath : '.'
  },
  /**
   * @param {string} path
   * @returns {string}
   */
  toNamespacedPath(path) {
    return path
  },
  /**
   * @param {string} pathname
   * @returns {string}
   */
  extname(pathname) {
    let index = pathname.length

    while (index--) {
      const code = pathname.codePointAt(index)

      if (code === 47 /* `/` */) {
        return ''
      }

      if (code === 46 /* `.` */) {
        return pathname.codePointAt(index - 1) === 47 /* `/` */
          ? ''
          : pathname.slice(index)
      }
    }

    return ''
  },
  /**
   * @param {string} path
   * @returns {string}
   */
  dirname(path) {
    validateString(path, 'path')
    if (path.length === 0) return '.'
    // eslint-disable-next-line unicorn/prefer-code-point
    const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH
    let end = -1
    let matchedSlash = true
    for (let i = path.length - 1; i >= 1; --i) {
      // eslint-disable-next-line unicorn/prefer-code-point
      if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
        if (!matchedSlash) {
          end = i
          break
        }
      } else {
        // We saw the first non-path separator
        matchedSlash = false
      }
    }

    if (end === -1) return hasRoot ? '/' : '.'
    if (hasRoot && end === 1) return '//'
    return path.slice(0, end)
  },
  /**
   * @param {string} path
   * @returns {string}
   */
  normalize(path) {
    validateString(path, 'path')

    if (path.length === 0) return '.'

    // eslint-disable-next-line unicorn/prefer-code-point
    const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH
    const trailingSeparator =
      // eslint-disable-next-line unicorn/prefer-code-point
      path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH

    // Normalize the path
    path = normalizeString(path, !isAbsolute, '/', isPosixPathSeparator)

    if (path.length === 0) {
      if (isAbsolute) return '/'
      return trailingSeparator ? './' : '.'
    }

    if (trailingSeparator) path += '/'

    return isAbsolute ? `/${path}` : path
  },
  /**
   * @param {string} path
   * @returns {string}
   */
  basename(path) {
    validateString(path, 'path')

    let start = 0
    let end = -1
    let matchedSlash = true

    for (let i = path.length - 1; i >= 0; --i) {
      // eslint-disable-next-line unicorn/prefer-code-point
      if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1
          break
        }
      } else if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // path component
        matchedSlash = false
        end = i + 1
      }
    }

    if (end === -1) return ''
    return path.slice(start, end)
  }
}
export default path
