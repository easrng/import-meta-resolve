/* eslint-disable capitalized-comments */
/* eslint-disable no-bitwise */
import {codes} from './errors.js'
import path from './node-path.js'
import {CHAR_FORWARD_SLASH} from './utils.js'

/**
 * @param {URL} url
 */
function getPathFromURLPosix(url) {
  if (url.hostname !== '') {
    throw new codes.ERR_INVALID_FILE_URL_HOST()
  }

  const pathname = url.pathname
  for (let n = 0; n < pathname.length; n++) {
    if (pathname[n] === '%') {
      const third = (pathname.codePointAt(n + 2) || 0) | 0x20
      if (pathname[n + 1] === '2' && third === 102) {
        throw new codes.ERR_INVALID_FILE_URL_PATH(
          'must not include encoded / characters'
        )
      }
    }
  }

  return decodeURIComponent(pathname)
}

/**
 * @param {string | URL} path
 */
export function fileURLToPath(path) {
  if (typeof path === 'string') {
    path = new URL(path)
  } else if (!(path instanceof URL)) {
    throw new codes.ERR_INVALID_ARG_TYPE('path', ['string', 'URL'], path)
  }

  if (path.protocol !== 'file:') {
    throw new codes.ERR_INVALID_URL_SCHEME('file')
  }

  return getPathFromURLPosix(path)
}

// The following characters are percent-encoded when converting from file path
// to URL:
// - %: The percent character is the only character not encoded by the
//        `pathname` setter.
// - \: Backslash is encoded on non-windows platforms since it's a valid
//      character but the `pathname` setters replaces it by a forward slash.
// - LF: The newline character is stripped out by the `pathname` setter.
//       (See whatwg/url#419)
// - CR: The carriage return character is also stripped out by the `pathname`
//       setter.
// - TAB: The tab character is also stripped out by the `pathname` setter.
const percentRegEx = /%/g
const backslashRegEx = /\\/g
const newlineRegEx = /\n/g
const carriageReturnRegEx = /\r/g
const tabRegEx = /\t/g
const questionRegex = /\?/g
const hashRegex = /#/g

/**
 * @param {string} filepath
 */
function encodePathChars(filepath) {
  if (filepath.includes('%')) filepath = filepath.replace(percentRegEx, '%25')
  // In posix, backslash is a valid character in paths:
  if (filepath.includes('\\'))
    filepath = filepath.replace(backslashRegEx, '%5C')
  if (filepath.includes('\n')) filepath = filepath.replace(newlineRegEx, '%0A')
  if (filepath.includes('\r'))
    filepath = filepath.replace(carriageReturnRegEx, '%0D')
  if (filepath.includes('\t')) filepath = filepath.replace(tabRegEx, '%09')
  return filepath
}

/**
 * @param {string} filepath
 */
export function pathToFileURL(filepath) {
  let resolved = path.resolve(filepath)
  // path.resolve strips trailing slashes so we must add them back
  // eslint-disable-next-line unicorn/prefer-code-point
  const filePathLast = filepath.charCodeAt(filepath.length - 1)
  if (
    filePathLast === CHAR_FORWARD_SLASH &&
    resolved[resolved.length - 1] !== path.sep
  )
    resolved += '/'

  // Call encodePathChars first to avoid encoding % again for ? and #.
  resolved = encodePathChars(resolved)

  // Question and hash character should be included in pathname.
  // Therefore, encoding is required to eliminate parsing them in different states.
  // This is done as an optimization to not creating a URL instance and
  // later triggering pathname setter, which impacts performance
  if (resolved.includes('?')) resolved = resolved.replace(questionRegex, '%3F')
  if (resolved.includes('#')) resolved = resolved.replace(hashRegex, '%23')
  return new URL(`file://${resolved}`)
}
