import {AbortError, BugError, handler, cleanSingleStackTracePath, shouldReportErrorAsUnexpected} from './error.js'
import {renderFatalError} from './ui.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./ui.js')

describe('handler', () => {
  test('error output uses same input error instance when the error type is abort', async () => {
    // Given
    const abortError = new AbortError('error message', 'try message')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(abortError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(abortError)
  })

  test('error output uses same input error instance when the error type is bug', async () => {
    // Given
    const bugError = new BugError('error message', 'try message')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(bugError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(bugError)
  })

  test('error output uses a BugError instance instance when the error type not extends from fatal', async () => {
    // Given
    const unknownError = new Error('Unknown')
    vi.mocked(renderFatalError).mockResolvedValue('')

    // When
    await handler(unknownError)

    // Then
    expect(renderFatalError).toHaveBeenCalledWith(expect.objectContaining({type: expect.any(Number)}))
    expect(unknownError).not.contains({type: expect.any(Number)})
  })
})

describe('stack file path helpers', () => {
  test.each([
    // Original tests - updated for aggressive normalization
    ['simple file:///', 'file:///something/there.js', 'something/there.js'],
    ['windows file://', 'file:///D:\\something\\there.js', 'something/there.js'],
    ['unix no file', '/something/there.js', 'something/there.js'],
    ['windows no file', 'D:\\something\\there.js', 'something/there.js'],

    // Home directory normalization - user-specific parts stripped
    ['macOS home', '/Users/john/project/file.js', 'project/file.js'],
    ['Linux home', '/home/jane/work/app.js', 'work/app.js'],
    ['root home', '/root/.config/app.js', '.config/app.js'],
    ['Windows home old', '/Documents and Settings/user/file.js', 'file.js'],

    // Windows AppData paths - all now aggressively normalized
    [
      'Windows AppData Roaming',
      '/Users/LENOVO/AppData/Roaming/npm/node_modules/@shopify/cli/dist/chunk-AE3MLJMV.js',
      '@shopify/cli/dist/chunk-<HASH>.js',
    ],
    ['Windows AppData Local', '/Users/john/AppData/Local/Programs/app.js', 'app.js'],
    ['Windows AppData Temp', '/Users/john/AppData/Local/Temp/test.js', 'test.js'],

    // Temp directory normalization - all stripped now
    ['Unix tmp', '/tmp/build/app.js', 'build/app.js'],
    ['macOS temp folders', '/var/folders/zz/zyxvpxvq6csfxvn_n0000000000000/T/test.js', 'test.js'],
    ['Already normalized home temp', '<HOME>/AppData/Local/Temp/file.js', '<HOME>/AppData/Local/Temp/file.js'],

    // Global package manager paths - all stripped to package name
    ['npm global unix', '/usr/local/lib/node_modules/@shopify/cli/index.js', '@shopify/cli/index.js'],
    ['npm global linux', '/usr/lib/node_modules/typescript/lib/tsc.js', 'typescript/lib/tsc.js'],
    ['npm custom global', '<HOME>/.npm-global/lib/node_modules/eslint/index.js', 'eslint/index.js'],
    ['yarn cache', '<HOME>/.yarn/berry/cache/package.js', 'package.js'],
    ['yarn global', '<HOME>/.config/yarn/global/node_modules/prettier/index.js', 'prettier/index.js'],
    ['pnpm store', '<HOME>/.pnpm-store/package.js', 'package.js'],
    ['pnpm global', '<HOME>/.local/share/pnpm/global/5/node_modules/@shopify/cli/index.js', '@shopify/cli/index.js'],

    // Webpack chunk hash normalization
    ['webpack chunk uppercase', '@shopify/cli/dist/chunk-AE3MLJMV.js', '@shopify/cli/dist/chunk-<HASH>.js'],
    ['webpack chunk lowercase', 'dist/chunk.1a2b3c4d.js', 'dist/chunk.<HASH>.js'],
    ['webpack chunk long hash', 'bundle.chunk.abcdef1234567890.js', 'bundle.chunk.<HASH>.js'],

    // Other hash patterns
    ['js file with hash', 'dist/main.12345678.js', 'dist/main.<HASH>.js'],
    ['mjs file with hash', 'lib/module.abcdef12.mjs', 'lib/module.<HASH>.mjs'],
    ['ts file with long hash', 'src/component.1234567890abcdef.ts', 'src/component.<HASH>.ts'],

    // CI/CD environments - all stripped now
    [
      'GitHub Actions',
      '/home/runner/work/shopify-cli/shopify-cli/packages/cli-kit/src/error.js',
      'work/shopify-cli/shopify-cli/packages/cli-kit/src/error.js',
    ],
    ['GitHub workspace', '/github/workspace/src/index.js', 'src/index.js'],
    ['Netlify', '/opt/build/repo/dist/app.js', 'build/repo/dist/app.js'],
    ['GitLab CI', '/builds/group/project/src/main.js', 'group/project/src/main.js'],

    // Complex real-world examples - all normalized to package path
    [
      'Global npm Windows path from issue',
      '/Users/LENOVO/AppData/Roaming/npm/node_modules/@shopify/cli/dist/chunk-H44KHRQ3.js',
      '@shopify/cli/dist/chunk-<HASH>.js',
    ],
    ['Local installation', '@shopify/cli/dist/chunk-H44KHRQ3.js', '@shopify/cli/dist/chunk-<HASH>.js'],

    // Path separator normalization - all stripped
    ['Windows backslashes', 'C:\\Users\\john\\project\\src\\file.js', 'project/src/file.js'],
    ['Mixed separators', '/Users/john\\work/project\\file.js', 'work/project/file.js'],

    // Additional CI/CD environments - all stripped
    ['Bitbucket Pipelines', '/bitbucket/pipelines/agent/build/src/index.js', 'build/src/index.js'],
    ['AWS CodeBuild', '/codebuild/output/src123/src/app.js', 'src/app.js'],

    // Container environments - all stripped
    ['Docker /app', '/app/src/components/Button.js', 'src/components/Button.js'],
    ['Docker /workspace', '/workspace/lib/utils.js', 'lib/utils.js'],
    ['Docker /usr/src/app', '/usr/src/app/index.js', 'src/app/index.js'],

    // Version numbers in paths - stripped to package path
    ['pnpm with version', 'node_modules/.pnpm/react@18.2.0/node_modules/react/index.js', 'react/index.js'],
    ['npm scoped package', 'node_modules/@shopify/cli@3.45.0/dist/index.js', '@shopify/cli@<VERSION>/dist/index.js'],

    // UUID normalization
    ['UUID in path', '/tmp/a1b2c3d4-e5f6-7890-abcd-ef1234567890/file.js', '<UUID>/file.js'],
    ['Uppercase UUID', '/var/A1B2C3D4-E5F6-7890-ABCD-EF1234567890/app.js', 'var/<UUID>/app.js'],
  ])('%s: %s -> %s', (_, input, expected) => {
    expect(cleanSingleStackTracePath(input)).toEqual(expected)
  })

  // Security tests
  test('handles path traversal attempts', () => {
    // After sanitization: /Users/../../../etc/passwd removes all ../ -> Users/etc/passwd -> etc/passwd -> passwd (after stripping common prefixes)
    expect(cleanSingleStackTracePath('/Users/../../../etc/passwd')).toBe('passwd')
    // After sanitization: /home/user/../../etc/shadow removes all ../ -> home/user/etc/shadow -> etc/shadow (after stripping home/user/)
    expect(cleanSingleStackTracePath('/home/user/../../etc/shadow')).toBe('etc/shadow')
  })

  test('handles extremely long paths', () => {
    const longPath = `/Users/john/${'a'.repeat(2000)}/file.js`
    const result = cleanSingleStackTracePath(longPath)
    expect(result.length).toBeLessThanOrEqual(1003)
    expect(result).toMatch(/\.\.\.$/)
  })

  test('strips drive letters', () => {
    expect(cleanSingleStackTracePath('C:/Users/john/file.js')).toBe('file.js')
    expect(cleanSingleStackTracePath('D:/Projects/app.js')).toBe('Projects/app.js')
  })

  // Edge case tests
  test('handles end-of-path UUIDs', () => {
    expect(cleanSingleStackTracePath('/tmp/build-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('build-<UUID>')
  })

  test('handles end-of-path versions', () => {
    expect(cleanSingleStackTracePath('node_modules/@shopify/cli@3.45.0')).toBe('@shopify/cli@<VERSION>')
  })
})

describe('shouldReportErrorAsUnexpected helper', () => {
  test('returns true for normal errors', () => {
    expect(shouldReportErrorAsUnexpected(new Error('test'))).toBe(true)
  })

  test('returns false for AbortError', () => {
    expect(shouldReportErrorAsUnexpected(new AbortError('test'))).toBe(false)
  })

  test('returns true for BugError', () => {
    expect(shouldReportErrorAsUnexpected(new BugError('test'))).toBe(true)
  })

  test('returns false for errors that imply environment issues', () => {
    expect(shouldReportErrorAsUnexpected(new Error('EPERM: operation not permitted, scandir'))).toBe(false)
  })
})
