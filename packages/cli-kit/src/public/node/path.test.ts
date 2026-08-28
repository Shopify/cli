import {
  relativizePath,
  normalizePath,
  cwd,
  sniffForPath,
  commonParentDirectory,
  isSubpath,
  sniffForJson,
  sanitizeRelativePath,
} from './path.js'
import {describe, test, expect, vi} from 'vitest'

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

describe('isSubpath', () => {
  test('returns true if the second path is a subpath of the first path', () => {
    expect(isSubpath('/foo', '/foo/bar')).toBe(true)
    expect(isSubpath('/foo', '/foo/bar/baz')).toBe(true)
  })

  test('returns false if the second path is not a subpath of the first path', () => {
    expect(isSubpath('/foo', '/bar')).toBe(false)
    expect(isSubpath('/foo/bar', '/foo')).toBe(false)
  })

  test('returns true if the paths are identical', () => {
    expect(isSubpath('/foo', '/foo')).toBe(true)
  })
})

describe('sniffForJson', () => {
  test('returns true if --json is present', () => {
    expect(sniffForJson(['node', 'script.js', '--json'])).toBe(true)
  })

  test('returns true if -j is present', () => {
    expect(sniffForJson(['node', 'script.js', '-j'])).toBe(true)
  })

  test('returns false if neither is present', () => {
    expect(sniffForJson(['node', 'script.js', '--other-flag'])).toBe(false)
  })

  test.each(['--json', '-j'])('returns false if %s is a passthrough argument', (jsonFlag) => {
    expect(sniffForJson(['node', 'script.js', '--', jsonFlag])).toBe(false)
  })

  test('does not treat clustered short flags as JSON output', () => {
    expect(sniffForJson(['node', 'script.js', '-vj'])).toBe(false)
  })
})

describe('sanitizeRelativePath', () => {
  test('does not modify standard relative paths and does not warn', () => {
    const warn = vi.fn()
    expect(sanitizeRelativePath('foo/bar', warn)).toBe('foo/bar')
    expect(warn).not.toHaveBeenCalled()
  })

  test('removes double dots and warns', () => {
    const warn = vi.fn()
    expect(sanitizeRelativePath('foo/../bar', warn)).toBe('bar')
    expect(warn).toHaveBeenCalledWith("Warning: path 'foo/../bar' contains '..' traversal — sanitized to 'bar'\n")
  })

  test('collapses nested double dots to top-level directory and warns', () => {
    const warn = vi.fn()
    expect(sanitizeRelativePath('foo/../../bar', warn)).toBe('bar')
    expect(warn).toHaveBeenCalledWith("Warning: path 'foo/../../bar' contains '..' traversal — sanitized to 'bar'\n")
  })

  test('handles single dots by collapsing them and does not warn', () => {
    const warn = vi.fn()
    expect(sanitizeRelativePath('foo/./bar', warn)).toBe('foo/bar')
    expect(warn).not.toHaveBeenCalled()
  })
})
