import {relativizePath, normalizePath, cwd, sniffForPath, commonParentDirectory} from './path.js'
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
