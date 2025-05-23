import {
  relativizePath,
  normalizePath,
  cwd,
  sniffForPath,
  sniffForJson,
  joinPath,
  resolvePath,
  relativePath,
  isAbsolutePath,
  dirname,
  basename,
  extname,
  isSubpath,
  moduleDirectory,
} from './path.js'
import {describe, test, expect, vi} from 'vitest'

describe('joinPath', () => {
  test('joins multiple paths', () => {
    expect(joinPath('a', 'b', 'c')).toBe('a/b/c')
  })

  test('handles empty paths', () => {
    expect(joinPath('a', '', 'c')).toBe('a/c')
  })
})

describe('normalizePath', () => {
  test('normalizes path with dots', () => {
    expect(normalizePath('/a/b/../c')).toBe('/a/c')
  })
})

describe('resolvePath', () => {
  test('resolves relative paths', () => {
    const result = resolvePath('..', 'test')
    expect(result).toContain('test')
  })
})

describe('relativePath', () => {
  test('returns relative path between two paths', () => {
    expect(relativePath('/a/b', '/a/c')).toBe('../c')
  })
})

describe('isAbsolutePath', () => {
  test('returns true for absolute paths', () => {
    expect(isAbsolutePath('/absolute/path')).toBe(true)
  })

  test('returns false for relative paths', () => {
    expect(isAbsolutePath('relative/path')).toBe(false)
  })
})

describe('dirname', () => {
  test('returns directory name', () => {
    expect(dirname('/path/to/file.txt')).toBe('/path/to')
  })
})

describe('basename', () => {
  test('returns base name without extension', () => {
    expect(basename('/path/to/file.txt')).toBe('file.txt')
  })

  test('returns base name with extension removed', () => {
    expect(basename('/path/to/file.txt', '.txt')).toBe('file')
  })
})

describe('extname', () => {
  test('returns file extension', () => {
    expect(extname('/path/to/file.txt')).toBe('.txt')
  })

  test('returns empty string for no extension', () => {
    expect(extname('/path/to/file')).toBe('')
  })
})

describe('isSubpath', () => {
  test('returns true when second path is subpath of first', () => {
    expect(isSubpath('/parent', '/parent/child')).toBe(true)
  })

  test('returns false when second path is not subpath of first', () => {
    expect(isSubpath('/parent', '/other')).toBe(false)
  })

  test('returns false when second path is absolute and not under first', () => {
    expect(isSubpath('/parent', '/root/other')).toBe(false)
  })
})

describe('moduleDirectory', () => {
  test('returns directory from import.meta.url string', () => {
    const url = import.meta.url
    const result = moduleDirectory(url)
    expect(result).toMatch(/packages\/cli-kit\/src\/public\/node$/)
  })

  test('returns directory from URL object', () => {
    const url = new URL(import.meta.url)
    const result = moduleDirectory(url)
    expect(result).toMatch(/packages\/cli-kit\/src\/public\/node$/)
  })
})

describe('relativizePath', () => {
  test('relativizes the path', () => {
    // Given
    const cwd = '/path/to/project/sub-directory'
    const directory = '/path/to/project/extensions/my-extension'

    // When
    const got = relativizePath(directory, cwd)

    // Then
    expect(got).toMatchInlineSnapshot('"../extensions/my-extension"')
  })

  test('returns absolute path when no common directory', () => {
    // Given
    const cwd = '/completely/different/path'
    const directory = '/path/to/project'

    // When
    const got = relativizePath(directory, cwd)

    // Then
    expect(got).toBe('/path/to/project')
  })

  test('returns absolute path when empty relative path', () => {
    // Given
    const samePath = '/path/to/project'

    // When
    const got = relativizePath(samePath, samePath)

    // Then
    expect(got).toBe('/path/to/project')
  })

  test('returns absolute path when too many levels up (> 2)', () => {
    // Given
    const cwd = '/path/to/project/very/deep/nested/directory'
    const directory = '/path/different'

    // When
    const got = relativizePath(directory, cwd)

    // Then
    expect(got).toBe('/path/different')
  })

  test('returns relative path for reasonable levels up (≤ 2)', () => {
    // Given
    const cwd = '/path/to/project/sub'
    const directory = '/path/to/other'

    // When
    const got = relativizePath(directory, cwd)

    // Then
    expect(got).toBe('../../other')
  })
})

describe('cwd', () => {
  test('returns process.cwd() when INIT_CWD is not set', () => {
    // Given
    const originalInitCwd = process.env.INIT_CWD
    const originalCwd = process.cwd
    delete process.env.INIT_CWD

    // Mock process.cwd to return a known value
    const mockCwd = '/mocked/current/directory'
    process.cwd = vi.fn(() => mockCwd)

    // When
    const result = cwd()

    // Then
    expect(result).toBe(normalizePath(mockCwd))

    // Cleanup
    process.cwd = originalCwd
    if (originalInitCwd) {
      process.env.INIT_CWD = originalInitCwd
    }
  })

  test.runIf(process.env.INIT_CWD)('returns the initial cwd where the command has been called', () => {
    // Given
    const path = cwd()

    // Then
    expect(path).toStrictEqual(normalizePath(process.env.INIT_CWD!))
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

  test('returns undefined when path flag is followed by another flag', () => {
    // Given
    const argv = ['node', 'script.js', '--path', '--verbose']

    // When
    const path = sniffForPath(argv)

    // Then
    expect(path).toBeUndefined()
  })

  test('returns undefined when path flag is at end of args', () => {
    // Given
    const argv = ['node', 'script.js', '--path']

    // When
    const path = sniffForPath(argv)

    // Then
    expect(path).toBeUndefined()
  })
})

describe('sniffForJson', () => {
  test('returns true when --json flag is present', () => {
    // Given
    const argv = ['node', 'script.js', '--json']

    // When
    const isJson = sniffForJson(argv)

    // Then
    expect(isJson).toBe(true)
  })

  test('returns true when -j flag is present', () => {
    // Given
    const argv = ['node', 'script.js', '-j']

    // When
    const isJson = sniffForJson(argv)

    // Then
    expect(isJson).toBe(true)
  })

  test('returns false when no json flags are present', () => {
    // Given
    const argv = ['node', 'script.js', '--other-flag']

    // When
    const isJson = sniffForJson(argv)

    // Then
    expect(isJson).toBe(false)
  })

  test('returns true when both flags are present', () => {
    // Given
    const argv = ['node', 'script.js', '--json', '-j']

    // When
    const isJson = sniffForJson(argv)

    // Then
    expect(isJson).toBe(true)
  })
})
