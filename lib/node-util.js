/* eslint-disable no-control-regex */
/* eslint-disable capitalized-comments */
/* eslint-disable unicorn/no-for-loop */
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

import {assert} from './assert.js'

const formatRegExp = /%[sdj%]/g
export const format = function (
  /** @type {unknown} */ f,
  /** @type {unknown[]} */ ...arguments_
) {
  arguments_.unshift(f)
  if (!isString(f)) {
    /** @type {string[]} */
    const objects = []
    for (let i = 0; i < arguments_.length; i++) {
      objects.push(inspect(arguments_[i]))
    }

    return objects.join(' ')
  }

  let i = 1
  const length = arguments_.length
  let string_ = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') return '%'
    if (i >= length) return x
    switch (x) {
      case '%s': {
        return String(arguments_[i++])
      }

      case '%d': {
        return String(Number(arguments_[i++]))
      }

      case '%j': {
        try {
          return JSON.stringify(arguments_[i++])
        } catch {
          return '[Circular]'
        }
      }

      default: {
        return x
      }
    }
  })
  for (let x = arguments_[i]; i < length; x = arguments_[++i]) {
    string_ += ' ' + (isNull(x) || !isObject(x) ? x : inspect(x))
  }

  return string_
}

/** @typedef {{seen: unknown[], stylize(_1: string, _2: string): string, depth?: number, colors?: boolean, showHidden?: boolean, customInspect?: boolean}} Context */

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {unknown} object The object to print out.
 * @param {unknown=} options Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors */
export function inspect(object, options) {
  // default options
  /** @type {Context} */
  const context = {
    seen: [],
    stylize: stylizeNoColor
  }
  if (isBoolean(options)) {
    // legacy...
    context.showHidden = options
  } else if (options) {
    // got an "options" object
    _extend(context, options)
  }

  // set default options
  if (isUndefined(context.showHidden)) context.showHidden = false
  if (isUndefined(context.depth)) context.depth = 2
  if (isUndefined(context.colors)) context.colors = false
  if (isUndefined(context.customInspect)) context.customInspect = true
  if (context.colors) context.stylize = stylizeWithColor
  return formatValue(context, object, context.depth)
}

// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  white: [37, 39],
  grey: [90, 39],
  black: [30, 39],
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39]
}

// Don't use 'blue' not visible on cmd.exe
/** @type {Record<string, keyof inspect.colors>} */
inspect.styles = {
  special: 'cyan',
  number: 'yellow',
  boolean: 'yellow',
  undefined: 'grey',
  null: 'bold',
  string: 'green',
  date: 'magenta',
  // "name": intentionally not styling
  regexp: 'red'
}

/**
 * @param {string} string_
 * @param {keyof inspect.styles} styleType
 */
function stylizeWithColor(string_, styleType) {
  const style = inspect.styles[styleType]

  if (style) {
    return (
      '\u001B[' +
      inspect.colors[style][0] +
      'm' +
      string_ +
      '\u001B[' +
      inspect.colors[style][1] +
      'm'
    )
  }

  return string_
}

/**
 * @param {string} string_
 * @param {keyof inspect.styles} _styleType
 */
function stylizeNoColor(string_, _styleType) {
  return string_
}

/**
 * @param {string[]} array
 */
function arrayToHash(array) {
  /** @type {Record<string, boolean>} */
  const hash = {}

  for (const value of array) {
    hash[value] = true
  }

  return hash
}

/**
 * @param {Context} context
 * @param {unknown} value
 * @param {number | null} recurseTimes
 * @returns {string}
 */
function formatValue(context, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (
    context.customInspect &&
    isObject(value) &&
    'inspect' in value &&
    isFunction(value.inspect) &&
    // Filter out the util module, it's inspect function is special
    value.inspect !== inspect &&
    // Also filter out any prototype objects using the circular check.
    !(
      value.constructor &&
      /** @type {{prototype: unknown}} */ (value.constructor).prototype ===
        value
    )
  ) {
    /** @type {unknown} */
    const returnValue = value.inspect(recurseTimes, context)
    return isString(returnValue)
      ? returnValue
      : formatValue(context, returnValue, recurseTimes)
  }

  // Primitive types cannot have properties
  const primitive = formatPrimitive(context, value)
  if (primitive) {
    return primitive
  }

  assert(isObject(value))

  // Look up the keys of the object.
  let keys = Object.keys(value)
  const visibleKeys = arrayToHash(keys)

  if (context.showHidden) {
    keys = Object.getOwnPropertyNames(value)
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (
    isError(value) &&
    (keys.includes('message') || keys.includes('description'))
  ) {
    return formatError(value)
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      const name = value.name ? ': ' + value.name : ''
      return context.stylize('[Function' + name + ']', 'special')
    }

    if (isRegExp(value)) {
      return context.stylize(RegExp.prototype.toString.call(value), 'regexp')
    }

    if (isDate(value)) {
      return context.stylize(Date.prototype.toString.call(value), 'date')
    }

    if (isError(value)) {
      return formatError(value)
    }
  }

  let base = ''
  let array = false
  let braces = ['{', '}']

  // Make Array say that they are Array
  if (Array.isArray(value)) {
    array = true
    braces = ['[', ']']
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    const n = value.name ? ': ' + value.name : ''
    base = ' [Function' + n + ']'
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value)
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value)
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value)
  }

  if (
    keys.length === 0 &&
    // eslint-disable-next-line unicorn/explicit-length-check
    (!array || ('length' in value && value.length) === 0)
  ) {
    return braces[0] + base + braces[1]
  }

  if ((recurseTimes || 0) < 0) {
    return isRegExp(value)
      ? context.stylize(RegExp.prototype.toString.call(value), 'regexp')
      : context.stylize('[Object]', 'special')
  }

  context.seen.push(value)

  /** @type {string[]} */
  let output
  if (array) {
    output = formatArray(
      context,
      /** @type {unknown[]} */ (value),
      recurseTimes,
      visibleKeys,
      keys
    )
  } else {
    output = keys.map(function (key) {
      return formatProperty(
        context,
        value,
        recurseTimes,
        visibleKeys,
        key,
        array
      )
    })
  }

  context.seen.pop()

  return reduceToSingleString(output, base, braces)
}

/**
 * @param {Context} context
 * @param {unknown} value
 * @returns
 */
function formatPrimitive(context, value) {
  if (isUndefined(value)) return context.stylize('undefined', 'undefined')
  if (isString(value)) {
    const simple =
      "'" +
      JSON.stringify(value)
        .replace(/^"|"$/g, '')
        .replace(/'/g, "\\'")
        .replace(/\\"/g, '"') +
      "'"
    return context.stylize(simple, 'string')
  }

  if (isNumber(value)) return context.stylize(String(value), 'number')
  if (isBoolean(value)) return context.stylize(String(value), 'boolean')
  // For some reason typeof null is "object", so special case here.
  if (isNull(value)) return context.stylize('null', 'null')
}

/**
 * @param {unknown} value
 */
function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']'
}

/**
 * @param {Context} context
 * @param {unknown[]} value
 * @param {number | null} recurseTimes
 * @param {Record<string, boolean>} visibleKeys
 * @param {string[]} keys
 */
function formatArray(context, value, recurseTimes, visibleKeys, keys) {
  /** @type {string[]} */
  const output = []
  for (let i = 0, l = value.length; i < l; ++i) {
    if (Object.hasOwn(value, String(i))) {
      output.push(
        formatProperty(
          context,
          value,
          recurseTimes,
          visibleKeys,
          String(i),
          true
        )
      )
    } else {
      output.push('')
    }
  }

  for (const key of keys) {
    if (!/^\d+$/.test(key)) {
      output.push(
        formatProperty(context, value, recurseTimes, visibleKeys, key, true)
      )
    }
  }

  return output
}

/**
 * @param {Context} context
 * @param {object} value
 * @param {number | null} recurseTimes
 * @param {Record<string, boolean>} visibleKeys
 * @param {string} key
 * @param {boolean} array
 */
function formatProperty(context, value, recurseTimes, visibleKeys, key, array) {
  /** @type {string | undefined} */
  let string_
  /** @type {string | undefined} */
  let name
  /** @type {Omit<PropertyDescriptor, 'value'> & {value?: unknown}} */
  const desc = Object.getOwnPropertyDescriptor(value, key) || {
    value: /** @type {Record<typeof key, unknown>} */ (value)[key]
  }
  if (desc.get) {
    string_ = desc.set
      ? context.stylize('[Getter/Setter]', 'special')
      : context.stylize('[Getter]', 'special')
  } else if (desc.set) {
    string_ = context.stylize('[Setter]', 'special')
  }

  if (!Object.hasOwn(visibleKeys, key)) {
    name = '[' + key + ']'
  }

  if (!string_) {
    if (context.seen.includes(desc.value)) {
      string_ = context.stylize('[Circular]', 'special')
    } else {
      string_ = isNull(recurseTimes)
        ? formatValue(context, desc.value, null)
        : formatValue(context, desc.value, recurseTimes - 1)
      if (string_.includes('\n')) {
        if (array) {
          string_ = string_
            .split('\n')
            .map(function (line) {
              return '  ' + line
            })
            .join('\n')
            .slice(2)
        } else {
          string_ =
            '\n' +
            string_
              .split('\n')
              .map(function (line) {
                return '   ' + line
              })
              .join('\n')
        }
      }
    }
  }

  if (isUndefined(name)) {
    if (array && /^\d+$/.test(key)) {
      return string_
    }

    name = JSON.stringify(String(key))
    if (/^"([a-zA-Z_]\w*)"$/.test(name)) {
      name = name.slice(1, -1)
      name = context.stylize(name, 'name')
    } else {
      name = name
        .replace(/'/g, "\\'")
        .replace(/\\"/g, '"')
        .replace(/(^"|"$)/g, "'")
      name = context.stylize(name, 'string')
    }
  }

  return name + ': ' + string_
}

/**
 * @param {string[]} output
 * @param {string} base
 * @param {string[]} braces
 */
function reduceToSingleString(output, base, braces) {
  const length = output.reduce(function (previous, current) {
    return previous + current.replace(/\u001B\[\d\d?m/g, '').length + 1
  }, 0)

  if (length > 60) {
    return (
      braces[0] +
      (base === '' ? '' : base + '\n ') +
      ' ' +
      output.join(',\n  ') +
      ' ' +
      braces[1]
    )
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1]
}

/**
 * @param {unknown} argument
 * @returns {argument is boolean}
 */
function isBoolean(argument) {
  return typeof argument === 'boolean'
}

/**
 * @param {unknown} argument
 * @returns {argument is null}
 */
function isNull(argument) {
  return argument === null
}

/**
 * @param {unknown} argument
 * @returns {argument is number}
 */
function isNumber(argument) {
  return typeof argument === 'number'
}

/**
 * @param {unknown} argument
 * @returns {argument is string}
 */
function isString(argument) {
  return typeof argument === 'string'
}

/**
 * @param {unknown} argument
 * @returns {argument is undefined}
 */
function isUndefined(argument) {
  return argument === undefined
}

/**
 * @param {unknown} re
 * @returns {re is RegExp}
 */
function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]'
}

/**
 * @param {unknown} argument
 * @returns {argument is object}
 */
function isObject(argument) {
  return typeof argument === 'object' && argument !== null
}

/**
 * @param {unknown} d
 * @returns {d is Date}
 */
function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]'
}

/**
 * @param {unknown} error
 * @returns {error is Error}
 */
function isError(error) {
  return (
    isObject(error) &&
    (objectToString(error) === '[object Error]' || error instanceof Error)
  )
}

/**
 * @param {unknown} argument
 * @returns {argument is Function}
 */
function isFunction(argument) {
  return typeof argument === 'function'
}

/**
 * @param {object} o
 */
function objectToString(o) {
  const oc =
    /** @type {{prototype: {toString: typeof Object.prototype.toString}}} */ (
      Object
    )
  return oc.prototype.toString.call(o)
}

const _extend = function (
  /** @type {{ [x: string]: unknown; }} */ origin,
  /** @type {unknown} */ add
) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin

  const keys = Object.keys(add)
  let i = keys.length
  while (i--) {
    origin[keys[i]] = /** @type {Record<string, unknown>} */ (add)[keys[i]]
  }

  return origin
}
