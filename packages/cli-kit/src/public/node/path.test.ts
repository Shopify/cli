import {relativizePath, normalizePath, cwd, sniffForPath, sniffForJson, commonParentDirectory} from './path.js'
import {describe, test, expect} from 'vitest'

describe('relativize', () => {
  test('relativizes the path', () => {
    // Given
    const cwd = '/path/to/project/sub-directory'
    const directory = '/path/to/project/extensions/my-extension'

    // When
    const got = relativizePath(directory, cwd)

    // Then
    expect(got).toMatchInlineSnapshot('"../extensions/my-extension"')
  })
})

describe('cwd', () => {
  test.runIf(process.env.INIT_CWD)('returns the initial cwd where the command has been called', () => {
    // Given
    const path = cwd()

    // Then
    expect(path).toStrictEqual(normalizePath(process.env.INIT_CWD!))
  })
})

describe('commonParentDirectory', () => {
  // Parity tests with the original 'commondir' npm package (v1.0.1)
  test('finds common parent for paths sharing a prefix', () => {
    expect(commonParentDirectory('/foo', '/foo/bar')).toBe('/foo')
    expect(commonParentDirectory('/foo/bar', '/foo//bar/baz')).toBe('/foo/bar')
  })

  test('finds deepest common ancestor', () => {
    expect(commonParentDirectory('/a/b/c', '/a/b')).toBe('/a/b')
    expect(commonParentDirectory('/a/b', '/a/b/c/d/e')).toBe('/a/b')
  })

  test('returns root when paths diverge at top level', () => {
    expect(commonParentDirectory('/x/y/z/w', '/xy/z')).toBe('/')
  })

  test('handles Windows-style paths', () => {
    expect(commonParentDirectory('X:\\foo', 'X:\\\\foo\\bar')).toBe('X:/foo')
    expect(commonParentDirectory('X:\\a\\b\\c', 'X:\\a\\b')).toBe('X:/a/b')
  })

  test('returns root for completely divergent Windows paths', () => {
    expect(commonParentDirectory('X:\\x\\y\\z\\w', '\\\\xy\\z')).toBe('/')
  })

  test('returns root for single-component paths', () => {
    expect(commonParentDirectory('/', '/')).toBe('/')
  })

  test('handles identical paths', () => {
    expect(commonParentDirectory('/a/b/c', '/a/b/c')).toBe('/a/b/c')
  })
})

describe('sniffForPath', () => {
  test('returns the path if provided', () => {
    // Given
    const argv = ['node', 'script.js', '--path', '/path/to/project']

    // When
    const path = sniffForPath(argv)

    // Then
    expect(path).toStrictEqual('/path/to/project')
  })

  test('returns undefined if no path provided', () => {
    // Given
    const argv = ['node', 'script.js']

    // When
    const path = sniffForPath(argv)

    // Then
    expect(path).toBeUndefined()
  })

  test('returns the path if provided with =', () => {
    // Given
    const argv = ['node', 'script.js', '--path=/path/to/project']

    // When
    const path = sniffForPath(argv)

    // Then
    expect(path).toStrictEqual('/path/to/project')
  })
})

describe('sniffForJson', () => {
  test.each([
    ['the --json flag', ['node', 'shopify', 'app', 'info', '--json']],
    ['the -j short flag', ['node', 'shopify', 'app', 'info', '-j']],
    ['a cluster ending in j, which oclif parses as -v -j', ['node', 'shopify', 'app', 'info', '-vj']],
    ['a cluster starting with j', ['node', 'shopify', 'app', 'info', '-jv']],
    ['--json before a passthrough separator', ['node', 'shopify', 'app', 'info', '--json', '--', 'extra']],
  ])('returns true for %s', (_label, argv) => {
    expect(sniffForJson(argv)).toBe(true)
  })

  test.each([
    ['no JSON flag at all', ['node', 'shopify', 'app', 'info']],
    ['a cluster of short flags without j', ['node', 'shopify', 'app', 'info', '-vf']],
    ['a bare dash, which is a positional argument rather than a flag', ['node', 'shopify', 'app', 'info', '-']],
    ['--json after the passthrough separator', ['node', 'shopify', 'app', 'function', 'run', '--', '--json']],
    ['-j after the passthrough separator', ['node', 'shopify', 'app', 'function', 'run', '--', '-j']],
    ['-vj after the passthrough separator', ['node', 'shopify', 'app', 'function', 'run', '--', '-vj']],
    ['a value that merely contains json', ['node', 'shopify', 'app', 'info', '--path', 'my-json-app']],
  ])('returns false for %s', (_label, argv) => {
    expect(sniffForJson(argv)).toBe(false)
  })

  test('reports JSON output as enabled when --json is really the value of a preceding flag', () => {
    // A documented false positive rather than a bug: telling this apart from a genuine
    // `--json` would mean knowing that `--path` takes a value, and every other flag's arity
    // with it, which is oclif's parser rather than a sniff. Erring towards JSON keeps machine
    // output parseable; the cost is a JSON error document for a command that never asked for
    // one, which a human reading the terminal sees rather than a script.
    expect(sniffForJson(['node', 'shopify', 'app', 'info', '--path', '--json'])).toBe(true)
  })
})
