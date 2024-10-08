// Manually “tree shaken” from:
// <https://github.com/nodejs/node/blob/7c3dce0/lib/internal/modules/esm/get_format.js>
// Last checked on: Apr 29, 2024.

import {fileURLToPath} from './node-url.js'
import {getPackageType} from './package-json-reader.js'
import {codes} from './errors.js'
import path from './node-path.js'

const {ERR_UNKNOWN_FILE_EXTENSION} = codes

const hasOwnProperty = {}.hasOwnProperty

/** @type {Record<string, string>} */
const extensionFormatMap = {
  // @ts-expect-error: hush.
  __proto__: null,
  '.cjs': 'commonjs',
  '.js': 'module',
  '.json': 'json',
  '.mjs': 'module',
  '.ts': 'typescript:module',
  '.mts': 'typescript:module',
  '.cts': 'typescript:commonjs'
}

/**
 * @param {string | null} mime
 * @returns {string | null}
 */
function mimeToFormat(mime) {
  if (
    mime &&
    /\s*(text|application)\/javascript\s*(;\s*charset=utf-?8\s*)?/i.test(mime)
  )
    return 'module'
  if (mime === 'application/json') return 'json'
  return null
}

/**
 * @callback ProtocolHandler
 * @param {URL} parsed
 * @param {import('./resolve.js').FS['readFileSync']} readFileSync
 * @param {boolean} ignoreErrors
 * @returns {string | null | void}
 */

/**
 * @type {Record<string, ProtocolHandler>}
 */
const protocolHandlers = {
  // @ts-expect-error: hush.
  __proto__: null,
  'data:': getDataProtocolModuleFormat,
  'file:': getFileProtocolModuleFormat,
  'http:': getHttpProtocolModuleFormat,
  'https:': getHttpProtocolModuleFormat,
  'node:'() {
    return 'builtin'
  }
}

/**
 * @param {URL} parsed
 */
function getDataProtocolModuleFormat(parsed) {
  const {1: mime} = /^([^/]+\/[^;,]+)[^,]*?(;base64)?,/.exec(
    parsed.pathname
  ) || [null, null, null]
  return mimeToFormat(mime)
}

/**
 * @type {ProtocolHandler}
 */
function getFileProtocolModuleFormat(url, readFileSync, ignoreErrors) {
  const value = path.extname(url.pathname)

  if (value === '.js' || value === '.ts') {
    const prefix = value === '.ts' ? 'typescript:' : ''
    const packageType = getPackageType({
      url,
      readFileSync
    })

    if (packageType !== 'none') {
      return prefix + packageType
    }

    return prefix + 'commonjs'
  }

  if (value === '') {
    const packageType = getPackageType({url, readFileSync})

    // Legacy behavior
    if (packageType === 'none' || packageType === 'commonjs') {
      return 'commonjs'
    }

    // Note: we don’t implement WASM, so we don’t need
    // `getFormatOfExtensionlessFile` from `formats`.
    return 'module'
  }

  const format = extensionFormatMap[value]
  if (format) return format

  // Explicit undefined return indicates load hook should rerun format check
  if (ignoreErrors) {
    return undefined
  }

  const filepath = fileURLToPath(url)
  throw new ERR_UNKNOWN_FILE_EXTENSION(value, filepath)
}

function getHttpProtocolModuleFormat() {
  // TODO: pick based on content-type
  return null
}

/**
 * @param {URL} url
 * @param {import('./resolve.js').FS['readFileSync']} readFileSync
 * @returns {string | null}
 */
export function defaultGetFormatWithoutErrors(url, readFileSync) {
  const protocol = url.protocol

  if (!hasOwnProperty.call(protocolHandlers, protocol)) {
    return null
  }

  return protocolHandlers[protocol](url, readFileSync, true) || null
}
