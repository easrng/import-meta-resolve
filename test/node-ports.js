import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from '../lib/node-url.js'
import {inspect, format} from '../lib/node-util.js'
import path from '../lib/node-path.js'

test('node ports', () => {
  assert.throws(() => fileURLToPath(/** @type {any} */ (0)))
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
})
