/* eslint-disable capitalized-comments */
import {validateString} from './errors.js'

const CHAR_FORWARD_SLASH = 0x2f
const CHAR_DOT = 0x2e

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
  }
}
export default path
