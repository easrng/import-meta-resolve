import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import {fileURLToPath, pathToFileURL} from '../lib/node-url.js'
import {inspect, format} from '../lib/node-util.js'
import path from '../lib/node-path.js'
import {emitWarning} from '../lib/errors.js'

function noop() {}

test('node ports', () => {
  /** @type {unknown[]} */
  const cases = [1, noop, null, new Error('Error'), Object.create(null)]
  for (const bad of cases)
    assert.throws(() => fileURLToPath(/** @type {any} */ (bad)))
  assert.equal(inspect(1, {colors: true}), '\u001B[33m1\u001B[39m')
  assert.equal(inspect({}, {colors: true}), '{}')
  assert.equal(format({}, []), '{} []')
  assert.equal(format('%d', '0x20'), '32')
  const circ = {}
  circ.circ = circ
  assert.equal(format('%j', circ), '[Circular]')
  assert.equal(format('hi', {}), 'hi {}')
  const hidden = {}
  Object.defineProperty(hidden, 'hi', {
    enumerable: false
  })
  assert.equal(inspect(hidden), '{}')
  assert.equal(inspect(hidden, true), '{ [hi]: undefined }')
  assert.equal(inspect(hidden, {showHidden: true}), '{ [hi]: undefined }')
  assert.throws(() => fileURLToPath(new URL('https://example')))
  assert.throws(() => fileURLToPath(new URL('file://example')))
  assert.throws(() => fileURLToPath(new URL('file:///%2F')))
  assert.equal(path.resolve('.', 'a', '', 'a/..', 'b/./'), '/a/b')
  assert.equal(inspect([[[[[]]]]]), '[ [ [ [Object] ] ] ]')
  const realEmitWarning = process.emitWarning
  const realConsoleWarn = console.warn
  // @ts-expect-error
  process.emitWarning = undefined
  let warnCount = 0
  console.warn = (/** @type {unknown} */ message) => {
    assert(String(message).startsWith('Warning: warn'))
    if (++warnCount === 2) console.warn = realConsoleWarn
  }

  assert.throws(() => emitWarning(/** @type {any} */ (0)))
  emitWarning('warn')
  emitWarning('warn', 'Warning', 'WARN')
  process.emitWarning = realEmitWarning
  assert.equal(pathToFileURL('/a\\%\n\t\r').href, 'file:///a%5C%25%0A%09%0D')
})
