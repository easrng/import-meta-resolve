/* eslint-disable new-cap */
/* eslint-disable no-throw-literal */
/* eslint-disable capitalized-comments */
import path from './node-path.js'
import {builtinModules} from './node-module.js'
import {fileURLToPath, pathToFileURL} from './node-url.js'
import {emitWarning, codes} from './errors.js'
import {
  getPackageScopeConfig,
  read as readPackageJson
} from './package-json-reader.js'
import {
  parsePackageName,
  packageImportsResolve,
  packageExportsResolve
} from './resolve.js'

const done = Symbol('done')
const notFound = Symbol('not found')

/**
 * @typedef {import("./resolve.js").FS} FS
 * @typedef {{ [done]: URL }} response
 */

/**
 * @param {unknown} object
 * @returns {object is response}
 */
function isResponse(object) {
  return typeof object === 'object' && object !== null && done in object
}

/**
 * @param {string} specifier
 * @param {URL} base
 * @param {FS} fs
 * @param {Set<string>} conditions
 * @returns {URL}
 */
export function cjsResolve(specifier, base, fs, conditions) {
  const basePath = fileURLToPath(base)
  try {
    REQUIRE(specifier, basePath, fs, conditions)
  } catch (error) {
    if (error === notFound) {
      throw new codes.ERR_MODULE_NOT_FOUND(specifier, basePath)
    } else if (isResponse(error)) {
      return error[done]
    } else {
      throw error
    }
  }
}

/**
 * @param {URL} result
 * @returns {never}
 */
function stopWith(result) {
  throw {[done]: result}
}

/**
 * @param {string} result
 * @param {FS} fs
 */
function tryStopWith(result, fs) {
  if (fs.statSync(result, {throwIfNoEntry: false})?.isFile()) {
    stopWith(pathToFileURL(fs.realpathSync(result)))
  }
}

// require(X) from module at path Y
/**
 * @param {string} X
 * @param {string} Y
 * @param {FS} fs
 * @param {Set<string>} conditions
 * @returns {never}
 */
function REQUIRE(X, Y, fs, conditions) {
  const maybeModule = X.match(/^[^@][^/]*|^@[^/]*\/[^/]*/)
  const nodePrefixed = X.startsWith('node:')
  // 1. If X is a core module,
  if (
    nodePrefixed ||
    (maybeModule && builtinModules.includes(maybeModule[0]))
  ) {
    //    a. return the core module
    //    b. STOP
    stopWith(new URL(nodePrefixed ? X : 'node:' + X))
  }

  // 2. If X begins with '/'
  if (X[0] === '/') {
    //    a. set Y to be the filesystem root
    Y = '/'
  }

  // 3. If X begins with './' or '/' or '../'
  if (/^\.{0,2}\//.test(X)) {
    //    a. LOAD_AS_FILE(Y + X)
    LOAD_AS_FILE(path.resolve(path.dirname(Y), X), fs)
    //    b. LOAD_AS_DIRECTORY(Y + X)
    LOAD_AS_DIRECTORY(path.resolve(path.dirname(Y), X), fs)
    //    c. THROW "not found"
    throw notFound
  }

  // 4. If X begins with '#'
  if (X[0] === '#') {
    //    a. LOAD_PACKAGE_IMPORTS(X, dirname(Y))
    /* spec is wrong, don't use dirname */
    LOAD_PACKAGE_IMPORTS(X, Y, fs, conditions)
  }

  // 5. LOAD_PACKAGE_SELF(X, dirname(Y))
  /* spec is wrong, don't use dirname */
  LOAD_PACKAGE_SELF(X, Y, fs, conditions)

  // 6. LOAD_NODE_MODULES(X, dirname(Y))
  LOAD_NODE_MODULES(X, path.dirname(Y), fs, conditions)

  // 7. THROW "not found"
  throw notFound
}

// LOAD_AS_FILE(X)
/**
 * @param {string} X
 * @param {FS} fs
 */
function LOAD_AS_FILE(X, fs) {
  // 1. If X is a file, load X as its file extension format. STOP
  tryStopWith(X, fs)
  // 2. If X.js is a file, load X.js as JavaScript text. STOP
  tryStopWith(X + '.js', fs)
  // 3. If X.json is a file, parse X.json to a JavaScript Object. STOP
  tryStopWith(X + '.json', fs)
  // 4. If X.node is a file, load X.node as binary addon. STOP
  tryStopWith(X + '.node', fs)
}

// LOAD_INDEX(X)
/**
 * @param {string} X
 * @param {FS} fs
 */
function LOAD_INDEX(X, fs) {
  // 1. If X/index.js is a file, load X/index.js as JavaScript text. STOP
  tryStopWith(X + '/index.js', fs)
  // 2. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
  tryStopWith(X + '/index.json', fs)
  // 3. If X/index.node is a file, load X/index.node as binary addon. STOP
  tryStopWith(X + '/index.node', fs)
}

// LOAD_AS_DIRECTORY(X)
/**
 * @param {string} X
 * @param {FS} fs
 */
function LOAD_AS_DIRECTORY(X, fs) {
  const pjsonPath = X + '/package.json'
  // 1. If X/package.json is a file,
  //    a. Parse X/package.json, and look for "main" field.
  /** @type {string | undefined} */
  let main
  try {
    main = readPackageJson(pjsonPath, fs.readFileSync).main
  } catch {}

  //    b. If "main" is a falsy value, GOTO 2.
  if (main) {
    //    c. let M = X + (json main field)
    const M = X + main
    //    d. LOAD_AS_FILE(M)
    LOAD_AS_FILE(M, fs)
    //    e. LOAD_INDEX(M)
    LOAD_INDEX(M, fs)
    //    f. LOAD_INDEX(X) DEPRECATED
    try {
      LOAD_INDEX(X, fs)
    } catch (/** @type {unknown} */ error) {
      if (isResponse(error)) {
        emitWarning(
          `Invalid 'main' field in '${pjsonPath}'. ` +
            'Please either fix that or report it to the module author',
          'DeprecationWarning',
          'DEP0128'
        )
      }

      throw error
    }

    //    g. THROW "not found"
    throw notFound
  }

  // 2. LOAD_INDEX(X)
  LOAD_INDEX(X, fs)
}

// LOAD_NODE_MODULES(X, START)
/**
 * @param {string} X
 * @param {string} START
 * @param {FS} fs
 * @param {Set<string>} conditions
 */
function LOAD_NODE_MODULES(X, START, fs, conditions) {
  // 1. let DIRS = NODE_MODULES_PATHS(START)
  const DIRS = NODE_MODULES_PATHS(START)
  // 2. for each DIR in DIRS:
  for (const DIR of DIRS) {
    //    a. LOAD_PACKAGE_EXPORTS(X, DIR)
    LOAD_PACKAGE_EXPORTS(X, DIR, fs, conditions)
    //    b. LOAD_AS_FILE(DIR/X)
    LOAD_AS_FILE(DIR + '/' + X, fs)
    //    c. LOAD_AS_DIRECTORY(DIR/X)
    LOAD_AS_DIRECTORY(DIR + '/' + X, fs)
  }
}

// NODE_MODULES_PATHS(START)
/**
 * @param {string} START
 */
function NODE_MODULES_PATHS(START) {
  // 1. let PARTS = path split(START)
  const PARTS = START.split('/')
  // 2. let I = count of PARTS - 1
  /* moved to for */
  // 3. let DIRS = [GLOBAL_FOLDERS]
  /** @type {string[]} */
  const DIRS = []
  // 4. while I >= 0,
  for (let I = PARTS.length - 1; I >= 0; I--) {
    //    a. if PARTS[I] = "node_modules" CONTINUE
    if (PARTS[I] === 'node_modules') continue
    //    b. DIR = path join(PARTS[0 .. I] + "node_modules")
    const DIR = PARTS.slice(0, I + 1).join('/') + '/node_modules'
    //    c. DIRS = DIRS + DIR
    DIRS.push(DIR)
    //    d. let I = I - 1
    /* moved to for */
  }

  // 5. return DIRS
  return DIRS
}

// LOAD_PACKAGE_IMPORTS(X, DIR)
/**
 * @param {string} X
 * @param {string} DIR
 * @param {FS} fs
 * @param {Set<string>} conditions
 * @returns
 */
function LOAD_PACKAGE_IMPORTS(X, DIR, fs, conditions) {
  // 1. Find the closest package scope SCOPE to DIR.
  // 2. If no scope was found, return.
  // 3. If the SCOPE/package.json "imports" is null or undefined, return.
  // 4. let MATCH = PACKAGE_IMPORTS_RESOLVE(X, pathToFileURL(SCOPE),
  //    ["node", "require"]) defined in the ESM resolver.
  const MATCH = packageImportsResolve(X, pathToFileURL(DIR), fs, conditions)
  // 5. RESOLVE_ESM_MATCH(MATCH).
  RESOLVE_ESM_MATCH(MATCH, fs)
}

// LOAD_PACKAGE_EXPORTS(X, DIR)
/**
 * @param {string} X
 * @param {string} DIR
 * @param {FS} fs
 * @param {Set<string>} conditions
 */
function LOAD_PACKAGE_EXPORTS(X, DIR, fs, conditions) {
  // 1. Try to interpret X as a combination of NAME and SUBPATH where the name
  //    may have a @scope/ prefix and the subpath begins with a slash (`/`).
  /** @type {ReturnType<typeof parsePackageName>} */
  let parsed
  /** @type {string} */
  let pjsonPath
  try {
    parsed = parsePackageName(X, undefined)
    // 2. If X does not match this pattern or DIR/NAME/package.json is not a file,
    //    return.
    pjsonPath = DIR + '/' + parsed.packageName + '/package.json'
    if (!fs.statSync(pjsonPath, {throwIfNoEntry: false})?.isFile()) {
      return
    }
  } catch {
    return
  }

  // 3. Parse DIR/NAME/package.json, and look for "exports" field.
  const package_ = readPackageJson(pjsonPath, fs.readFileSync)

  // 4. If "exports" is null or undefined, return.
  if (!package_.exports) return

  // 5. let MATCH = PACKAGE_EXPORTS_RESOLVE(pathToFileURL(DIR/NAME), "." + SUBPATH,
  //    `package.json` "exports", ["node", "require"]) defined in the ESM resolver.
  const MATCH = packageExportsResolve(
    pathToFileURL(pjsonPath),
    parsed.packageSubpath,
    package_,
    undefined,
    fs,
    conditions
  )

  // 6. RESOLVE_ESM_MATCH(MATCH)
  RESOLVE_ESM_MATCH(MATCH, fs)
}

// LOAD_PACKAGE_SELF(X, DIR)
/**
 * @param {string} X
 * @param {string} DIR
 * @param {FS} fs
 * @param {Set<string>} conditions
 */
function LOAD_PACKAGE_SELF(X, DIR, fs, conditions) {
  // 1. Find the closest package scope SCOPE to DIR.
  const packageConfig = getPackageScopeConfig(
    pathToFileURL(DIR),
    fs.readFileSync
  )
  // 2. If no scope was found, return.
  if (!packageConfig.exists) return
  // 3. If the SCOPE/package.json "exports" is null or undefined, return.
  if (!packageConfig.exports) return
  // 4. If the SCOPE/package.json "name" is not the first segment of X, return.
  if (!packageConfig.name || !(X + '/').startsWith(packageConfig.name + '/'))
    return
  // 5. let MATCH = PACKAGE_EXPORTS_RESOLVE(pathToFileURL(SCOPE),
  //    "." + X.slice("name".length), `package.json` "exports", ["node", "require"])
  //    defined in the ESM resolver.
  const MATCH = packageExportsResolve(
    pathToFileURL(packageConfig.pjsonPath),
    '.' + X.slice(packageConfig.name.length),
    packageConfig,
    undefined,
    fs,
    conditions
  )
  // 6. RESOLVE_ESM_MATCH(MATCH)
  RESOLVE_ESM_MATCH(MATCH, fs)
}

// RESOLVE_ESM_MATCH(MATCH)
/**
 * @param {URL} MATCH
 * @param {FS} fs
 */
function RESOLVE_ESM_MATCH(MATCH, fs) {
  // 1. let { RESOLVED, EXACT } = MATCH
  const RESOLVED = MATCH
  const EXACT = true
  // 2. let RESOLVED_PATH = fileURLToPath(RESOLVED)
  const RESOLVED_PATH = fileURLToPath(RESOLVED)
  // 3. If EXACT is true,
  if (EXACT) {
    //    a. If the file at RESOLVED_PATH exists, load RESOLVED_PATH as its extension
    //       format. STOP
    tryStopWith(RESOLVED_PATH, fs)
  } else {
    // 4. Otherwise, if EXACT is false,
    //    a. LOAD_AS_FILE(RESOLVED_PATH)
    LOAD_AS_FILE(RESOLVED_PATH, fs)
    //    b. LOAD_AS_DIRECTORY(RESOLVED_PATH)
    LOAD_AS_DIRECTORY(RESOLVED_PATH, fs)
  }

  // 5. THROW "not found"
  throw notFound
}
