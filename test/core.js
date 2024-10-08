/**
 * @typedef {import('../index.js').ErrnoException} ErrnoException
 */

import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import process from 'node:process'
import {URL, pathToFileURL} from 'node:url'
import test from 'node:test'
import semver from 'semver'
import {resolve} from '../index.js'
import {defaultResolve} from '../lib/resolve.js'

/**
 * The strict equivalence assertion tests a strict equality relation.
 * @param {string} actual
 * @param {string} end
 * @param {string} [message]
 * @returns {void}
 */
function assertEndsWith(actual, end, message) {
  if (!actual.endsWith(end)) {
    throw new assert.AssertionError({
      actual,
      expected: end,
      message,
      operator: 'endsWith',
      stackStartFn: assertEndsWith
    })
  }
}

const windows = process.platform === 'win32'
const nodeBefore18 = semver.lt(process.versions.node, '18.0.0')
const nodeBefore20 = semver.lt(process.versions.node, '20.0.0')
const {baseline} = {baseline: false}

const run = (/** @type {() => void} */ f) => f()

process.on('exit', async () => {
  try {
    // Has to be sync.
    fs.renameSync('package.json.bak', 'package.json')
  } catch (error) {
    const exception = /** @type {ErrnoException} */ (error)
    // ignore if not found, which will happen because baseline.js sometimes
    // skips the test.
    if (exception.code !== 'ENOENT') throw error
  }
})

test(
  'resolve(specifier, base?, conditions?)',
  // // Note: this is toggled by the `baseline*.js` tests (see `script.js` for details on why and how)
  {skip: false},
  async function () {
    assert(resolve, 'expected `resolve` to exist (needed for TS in baseline)')

    await fs.renameSync('package.json', 'package.json.bak')

    try {
      resolve('', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(exception.code, 'ERR_MODULE_NOT_FOUND', 'empty string')
    }

    try {
      resolve('./%2F.js', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(exception.code, 'ERR_INVALID_MODULE_SPECIFIER', 'encoded /')
    }

    try {
      resolve('abc', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_MODULE_NOT_FOUND',
        'unfound bare specifier'
      )
    }

    // Node before 20 throws for missing URLs.
    if (!nodeBefore20) {
      assert.equal(
        resolve('/abc', import.meta.url),
        new URL('/abc', import.meta.url).href,
        'unfound absolute path'
      )

      assert.equal(
        resolve('./abc', import.meta.url),
        new URL('abc', import.meta.url).href,
        'unfound relative path'
      )

      assert.equal(
        resolve('../abc', import.meta.url),
        new URL('../abc', import.meta.url).href,
        'unfound relative parental path'
      )
    }

    try {
      resolve('#', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_INVALID_MODULE_SPECIFIER',
        'empty import specifier'
      )
    }

    try {
      resolve('#/', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_INVALID_MODULE_SPECIFIER',
        'empty absolute import specifier'
      )
    }

    assert.equal(
      resolve('../tsconfig.json', import.meta.url),
      pathToFileURL('tsconfig.json').href,
      'should resolve a json file'
    )

    assert.equal(
      resolve('./index.js', import.meta.url),
      pathToFileURL('test/index.js').href,
      'should resolve a js file'
    )

    assert.equal(
      resolve('..', import.meta.url),
      pathToFileURL('./').href,
      'should resolve a directory (1)'
    )

    assert.equal(
      resolve('../lib', import.meta.url),
      pathToFileURL('./lib').href,
      'should resolve a directory (2)'
    )

    assert.equal(
      resolve('../lib/', import.meta.url),
      pathToFileURL('./lib/').href,
      'should resolve a directory (3)'
    )

    assertEndsWith(
      resolve('micromark', import.meta.url),
      '/node_modules/micromark/index.js',
      'should resolve a bare specifier to a package'
    )

    assertEndsWith(
      resolve('f-ck/index.js', import.meta.url),
      '/node_modules/f-ck/index.js',
      'should resolve a bare specifier plus path'
    )

    assertEndsWith(
      resolve('@bcoe/v8-coverage', import.meta.url),
      '/node_modules/@bcoe/v8-coverage/dist/lib/index.js',
      'should resolve a bare specifier w/ scope to a package'
    )

    try {
      resolve('xxx-missing', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_MODULE_NOT_FOUND',
        'missing bare specifier'
      )
    }

    try {
      resolve('@a/b', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_MODULE_NOT_FOUND',
        'missing scoped bare specifier'
      )
    }

    try {
      resolve('@scope-only', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_INVALID_MODULE_SPECIFIER',
        'invalid scoped specifier'
      )
    }

    try {
      resolve('%20', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_INVALID_MODULE_SPECIFIER',
        'invalid package name as specifier'
      )
    }

    try {
      resolve('micromark/index.js', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_PACKAGE_PATH_NOT_EXPORTED',
        'bare specifier w/ path that’s not exported'
      )
    }

    assertEndsWith(
      resolve('micromark/stream', import.meta.url),
      '/node_modules/micromark/stream.js',
      'should resolve a bare specifier + path which is exported'
    )

    assertEndsWith(
      resolve('micromark', import.meta.url),
      '/node_modules/micromark/index.js',
      'should cache results'
    )

    assert.equal(
      resolve('fs', import.meta.url),
      'node:fs',
      'should support internal node modules'
    )

    assert.equal(
      resolve('node:fs', import.meta.url),
      'node:fs',
      'should support `node:` protocols'
    )

    assert.equal(
      resolve('data:1', import.meta.url),
      'data:1',
      'should support `data:` protocols'
    )

    // Node before 18 fails on unknown protocols.
    if (!nodeBefore18) {
      assert.equal(
        resolve('xss:1', import.meta.url),
        'xss:1',
        'should support other protocols'
      )
    }

    if (!nodeBefore18) {
      try {
        resolve('node:fs', 'https://example.com/file.html')
        assert.fail()
      } catch (error) {
        const exception = /** @type {ErrnoException} */ (error)
        assert.equal(
          exception.code,
          'ERR_NETWORK_IMPORT_DISALLOWED',
          'should not support loading builtins from http'
        )
      }
    }

    assert.equal(
      resolve('./index.js?1', import.meta.url),
      new URL('index.js?1', import.meta.url).href,
      'should support a `search` in specifiers'
    )

    assert.equal(
      resolve('./index.js#1', import.meta.url),
      new URL('index.js#1', import.meta.url).href,
      'should support a `hash` in specifiers'
    )

    try {
      resolve('./example.js', 'data:1')
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      if (!nodeBefore18) {
        assert(exception.code)
        // To do: when pulling in new Node changes, the code is now
        // `ERR_UNSUPPORTED_RESOLVE_REQUEST` (from around Node 21.7).
        // Earlier was `ERR_INVALID_URL`.
        assert.ok(
          ['ERR_UNSUPPORTED_RESOLVE_REQUEST', 'ERR_INVALID_URL'].includes(
            exception.code
          ),
          'should not be able to resolve relative to a `data:` parent url'
        )
      }
    }

    assert.equal(
      resolve('./index.js', import.meta.url),
      new URL('index.js', import.meta.url).href,
      'should be able to find files w/o `package.json`'
    )

    assert.equal(
      resolve(
        './node_modules/no-package-json/with%20space.js',
        import.meta.url
      ),
      new URL('node_modules/no-package-json/with%20space.js', import.meta.url)
        .href,
      'should be able to find files with escaped spaces in their names'
    )

    assertEndsWith(
      resolve('micromark', import.meta.url),
      '/node_modules/micromark/index.js',
      'should be able to find packages w/o `package.json`'
    )

    try {
      resolve('xxx-missing', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_MODULE_NOT_FOUND',
        'missing packages w/o `package.json`'
      )
    }

    try {
      resolve('#local', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_PACKAGE_IMPORT_NOT_DEFINED',
        'missing import map w/o `package.json`'
      )
    }

    try {
      resolve('no-package-json', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_MODULE_NOT_FOUND',
        'should not be able to import packages that themselves don’t have `package.json`s (1)'
      )
    }

    try {
      resolve('package-no-main', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_MODULE_NOT_FOUND',
        'should not be able to import packages w/o index files'
      )
    }

    assert.equal(
      resolve('package-no-main-2', import.meta.url),
      new URL('node_modules/package-no-main-2/index.js', import.meta.url).href,
      'should be able to import CJS packages w/o `main`'
    )

    run(() => {
      assert(resolve, 'expected `resolve` to exist (needed for TS in baseline)')

      const oldEmitWarning = process.emitWarning
      /** @type {string | undefined} */
      let deprecation

      // @ts-expect-error hush
      process.emitWarning =
        /**
         * @param {unknown} _1
         * @param {unknown} _2
         * @param {string} code
         */
        (_1, _2, code) => {
          deprecation = code
        }

      assert.equal(
        resolve('package-no-main-3', import.meta.url),
        new URL('node_modules/package-no-main-3/index.js', import.meta.url)
          .href,
        'should be able to import ESM packages w/o `main`, but warn (1)'
      )

      if (nodeBefore18) {
        // Empty.
      } else {
        assert.equal(
          deprecation,
          'DEP0151',
          'should be able to import ESM packages w/o `main`, but warn (2)'
        )
      }

      deprecation = undefined

      assert.equal(
        resolve('package-export-map-6/index.js', import.meta.url),
        new URL(
          'node_modules/package-export-map-6/lib/index.js',
          import.meta.url
        ).href,
        'should be able to import packages with double slashes in `exports`, but warn (1)'
      )

      assert.equal(
        deprecation,
        'DEP0166',
        'should be able to import packages with double slashes in `exports`, but warn (2)'
      )

      process.emitWarning = oldEmitWarning
    })

    run(() => {
      assert(resolve, 'expected `resolve` to exist (needed for TS in baseline)')

      const oldEmitWarning = process.emitWarning
      /** @type {string | undefined} */
      let deprecation

      // @ts-expect-error hush
      process.emitWarning =
        /**
         * @param {unknown} _1
         * @param {unknown} _2
         * @param {string} code
         */
        (_1, _2, code) => {
          deprecation = code
        }

      assert.equal(
        resolve('package-no-main-4', import.meta.url),
        new URL('node_modules/package-no-main-4/index.js', import.meta.url)
          .href,
        'should be able to import ESM packages w/ non-full `main`, but warn (1)'
      )

      if (nodeBefore18) {
        // Empty.
      } else {
        assert.equal(
          deprecation,
          'DEP0151',
          'should be able to import ESM packages w/ non-full `main`, but warn (2)'
        )
      }

      process.emitWarning = oldEmitWarning
    })

    try {
      resolve('package-invalid-json', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_INVALID_PACKAGE_CONFIG',
        'should not be able to import packages w/ broken `package.json`s'
      )
    }

    assert.equal(
      resolve('package-export-map-1/a', import.meta.url),
      new URL('node_modules/package-export-map-1/b.js', import.meta.url).href,
      'should be able to resolve to something from an export map (1)'
    )

    assert.equal(
      resolve('package-export-map-1/lib/c', import.meta.url),
      new URL('node_modules/package-export-map-1/lib/c.js', import.meta.url)
        .href,
      'should be able to resolve to something from an export map (2)'
    )

    assert.equal(
      resolve('package-export-map-2', import.meta.url),
      new URL('node_modules/package-export-map-2/main.js', import.meta.url)
        .href,
      'should be able to resolve to something from a main export map'
    )

    try {
      resolve('package-export-map-2/missing', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_PACKAGE_PATH_NOT_EXPORTED',
        'should not be able to import things not in an export map'
      )
    }

    try {
      resolve('package-export-map-4', import.meta.url)
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_PACKAGE_PATH_NOT_EXPORTED',
        'should not be able to import things from an empty export map'
      )
    }

    run(() => {
      assert(resolve, 'expected `resolve` to exist (needed for TS in baseline)')

      const oldEmitWarning = process.emitWarning
      /** @type {string} */
      let deprecation

      // Windows doesn’t like `/` as a final path separator here.
      if (windows) return

      // @ts-expect-error hush
      process.emitWarning =
        /**
         * @param {unknown} _1
         * @param {unknown} _2
         * @param {string} code
         */
        (_1, _2, code) => {
          if (deprecation) assert.fail()
          deprecation = code
        }

      assert.equal(
        resolve(
          './a/',
          new URL('node_modules/package-export-map-5/', import.meta.url).href
        ),
        new URL('node_modules/package-export-map-5/a/', import.meta.url).href
      )

      try {
        // Twice for coverage: deprecation should fire only once.
        resolve(
          './a/b.js',
          new URL('node_modules/package-export-map-5/', import.meta.url).href
        )
        assert.fail()
      } catch {}

      process.emitWarning = oldEmitWarning
    })

    assert.equal(
      resolve(
        '#a',
        new URL('node_modules/package-import-map-1/', import.meta.url).href
      ),
      new URL('node_modules/package-import-map-1/index.js', import.meta.url)
        .href,
      'should be able to resolve to something from a main export map w/ package name'
    )

    try {
      resolve(
        '#b',
        new URL('node_modules/package-import-map-1/', import.meta.url).href
      )
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_PACKAGE_IMPORT_NOT_DEFINED',
        'should not be able to import things not in an import map'
      )
    }

    try {
      resolve(
        '#a',
        new URL('node_modules/package-import-map-2/', import.meta.url).href
      )
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      assert.equal(
        exception.code,
        'ERR_PACKAGE_IMPORT_NOT_DEFINED',
        'should not be able to import things not in an import map incorrectly defined w/o `#`'
      )
    }

    assert.equal(
      resolve(
        '#a/b.js',
        new URL('node_modules/package-import-map-3/', import.meta.url).href
      ),
      new URL('node_modules/package-import-map-3/index.js', import.meta.url)
        .href,
      'should be able to resolve to something to import map splats'
    )

    try {
      resolve(
        '#a/b.js',
        new URL('node_modules/package-import-map-4/', import.meta.url).href
      )
      assert.fail()
    } catch (error) {
      const exception = /** @type {ErrnoException} */ (error)
      if (!nodeBefore18) {
        assert.equal(
          exception.code,
          'ERR_PACKAGE_IMPORT_NOT_DEFINED',
          'should not be able to import an invalid import package target'
        )
      }
    }

    run(() => {
      assert(resolve, 'expected `resolve` to exist (needed for TS in baseline)')

      const oldEmitWarning = process.emitWarning
      /** @type {string | undefined} */
      let deprecation

      // @ts-expect-error hush
      process.emitWarning =
        /**
         * @param {unknown} _1
         * @param {unknown} _2
         * @param {string} code
         */
        (_1, _2, code) => {
          if (deprecation) assert.fail()
          deprecation = code
        }

      try {
        resolve(
          '#a/b.js',
          new URL('node_modules/package-import-map-5/', import.meta.url).href
        )
        assert.fail()
      } catch (error) {
        const exception = /** @type {ErrnoException} */ (error)
        if (!nodeBefore18) {
          assert.equal(
            exception.code,
            'ERR_PACKAGE_IMPORT_NOT_DEFINED',
            'should support legacy folders in import maps (1)'
          )
        }
      }

      process.emitWarning = oldEmitWarning
    })

    assert.equal(
      resolve(
        '#a',
        new URL('node_modules/package-import-map-6/', import.meta.url).href
      ),
      new URL('node:net').href,
      'should be able to resolve to a built-in node module'
    )

    assert.equal(
      resolve(
        'package-self-import-1',
        new URL('node_modules/package-self-import-1/', import.meta.url).href
      ),
      new URL('node_modules/package-self-import-1/index.js', import.meta.url)
        .href,
      'should be able to resolve a self-import'
    )

    assert.equal(
      resolve(
        'package-self-import-1',
        new URL(
          'node_modules/package-self-import-1/test/index.js',
          import.meta.url
        ).href
      ),
      new URL('node_modules/package-self-import-1/index.js', import.meta.url)
        .href,
      'should be able to resolve a self-import from a sub-file'
    )

    await assert.rejects(
      async () =>
        resolve(
          'package-self-import-2',
          new URL('node_modules/package-self-import-2/', import.meta.url).href
        ),
      /ERR_INVALID_PACKAGE_TARGET/,
      'should reject invalid main export map entries'
    )

    await assert.rejects(
      async () =>
        resolve(
          'package-self-import-2/a',
          new URL('node_modules/package-self-import-2/', import.meta.url).href
        ),
      /ERR_INVALID_PACKAGE_TARGET/,
      'should reject invalid export map entries'
    )

    assert.equal(
      resolve('package-custom-extensions', import.meta.url),
      new URL('node_modules/package-custom-extensions/b.ts', import.meta.url)
        .href,
      'should be able to resolve a custom `.ts` extension'
    )

    assert.equal(
      resolve('package-custom-extensions/c', import.meta.url),
      new URL('node_modules/package-custom-extensions/d.wasm', import.meta.url)
        .href,
      'should be able to resolve a custom `.wasm` extension'
    )

    if (!baseline) {
      console.log('running nonstandard tests')

      assert.throws(() =>
        defaultResolve('./index.js', fs, {
          parentURL: import.meta.url,
          conditions: /** @type {any} */ (1)
        })
      )

      assert.equal(
        defaultResolve('./index.js', fs, {
          parentURL: import.meta.url,
          conditions: []
        }).url,
        pathToFileURL('test/index.js').href
      )

      assert.equal(
        defaultResolve('os', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        'node:os'
      )

      assert.equal(
        defaultResolve('node:os', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        'node:os'
      )

      assert.equal(
        defaultResolve('./baseline', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        pathToFileURL('test/baseline.js').href
      )

      assert.equal(
        defaultResolve('../test', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        pathToFileURL('test/index.js').href
      )

      assert.throws(
        () =>
          defaultResolve('./node_modules/no-package-json/with%20space.js', fs, {
            parentURL: import.meta.url,
            conditions: ['require']
          }),
        'should be able to find files with escaped spaces in their names'
      )

      assert.equal(
        defaultResolve('no-package-json/with space', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        pathToFileURL('test/node_modules/no-package-json/with space.js').href
      )

      assert.equal(
        defaultResolve('package-main-1', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        pathToFileURL('test/node_modules/package-main-1/index.js').href
      )

      assert.equal(
        defaultResolve('#a', fs, {
          parentURL: new URL(
            'node_modules/package-import-map-1/fake.js',
            import.meta.url
          ).href,
          conditions: ['require']
        }).url,
        new URL('node_modules/package-import-map-1/index.js', import.meta.url)
          .href,
        'should be able to resolve to something from a main export map w/ package name'
      )

      assert.equal(
        defaultResolve('package-self-import-1', fs, {
          parentURL: new URL(
            'node_modules/package-self-import-1/',
            import.meta.url
          ).href,
          conditions: ['require']
        }).url,
        new URL('node_modules/package-self-import-1/index.js', import.meta.url)
          .href,
        'should be able to resolve a self-import'
      )

      try {
        defaultResolve('package-invalid-json', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        })
        assert.fail()
      } catch (error) {
        const exception = /** @type {ErrnoException} */ (error)
        assert.equal(
          exception.code,
          'ERR_INVALID_PACKAGE_CONFIG',
          'should not be able to import packages w/ broken `package.json`s'
        )
      }

      assert.equal(
        defaultResolve('package-export-map-1/a', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        new URL('node_modules/package-export-map-1/b.js', import.meta.url).href,
        'should be able to resolve to something from an export map (1)'
      )

      assert.equal(
        defaultResolve('package-export-map-1/lib/c', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        new URL('node_modules/package-export-map-1/lib/c.js', import.meta.url)
          .href,
        'should be able to resolve to something from an export map (2)'
      )

      assert.equal(
        defaultResolve('package-export-map-2', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        }).url,
        new URL('node_modules/package-export-map-2/main.js', import.meta.url)
          .href,
        'should be able to resolve to something from a main export map'
      )

      try {
        defaultResolve('package-export-map-2/missing', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        })
        assert.fail()
      } catch (error) {
        const exception = /** @type {ErrnoException} */ (error)
        assert.equal(
          exception.code,
          'ERR_PACKAGE_PATH_NOT_EXPORTED',
          'should not be able to import things not in an export map'
        )
      }

      try {
        defaultResolve('package-export-map-4', fs, {
          parentURL: import.meta.url,
          conditions: ['require']
        })
        assert.fail()
      } catch (error) {
        const exception = /** @type {ErrnoException} */ (error)
        assert.equal(
          exception.code,
          'ERR_PACKAGE_PATH_NOT_EXPORTED',
          'should not be able to import things from an empty export map'
        )
      }

      assert.equal(
        defaultResolve('data:application/json,hi', fs, {
          parentURL: import.meta.url,
          conditions: []
        }).format,
        'json'
      )

      assert.equal(
        defaultResolve('data:text/javascript,hi', fs, {
          parentURL: import.meta.url,
          conditions: []
        }).format,
        'module'
      )

      assert.deepEqual(
        defaultResolve('./b.ts', fs, {
          parentURL: new URL(
            'node_modules/package-custom-extensions/a.js',
            import.meta.url
          ).href
        }),
        {
          format: 'typescript:commonjs',
          url: new URL(
            'node_modules/package-custom-extensions/b.ts',
            import.meta.url
          ).href
        }
      )

      assert.throws(() =>
        defaultResolve('./b.js', fs, {
          parentURL: new URL(
            'node_modules/package-custom-extensions/a.js',
            import.meta.url
          ).href
        })
      )

      assert.deepEqual(
        defaultResolve('./b.js', fs, {
          parentURL: new URL(
            'node_modules/package-custom-extensions/a.ts',
            import.meta.url
          ).href
        }),
        {
          format: 'typescript:commonjs',
          url: new URL(
            'node_modules/package-custom-extensions/b.ts',
            import.meta.url
          ).href
        }
      )

      assert.deepEqual(
        defaultResolve('./b.mjs', fs, {
          parentURL: new URL(
            'node_modules/package-custom-extensions/a.ts',
            import.meta.url
          ).href
        }),
        {
          format: 'typescript:module',
          url: new URL(
            'node_modules/package-custom-extensions/b.mts',
            import.meta.url
          ).href
        }
      )
    }
  }
)
