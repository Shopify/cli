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
    // Original tests - updated to maintain backward compatibility
    ['simple file:///', 'file:///something/there.js', '/something/there.js'],
    ['windows file://', 'file:///D:\\something\\there.js', '<DRIVE_D>/something/there.js'],
    ['unix no file', '/something/there.js', '/something/there.js'],
    ['windows no file', 'D:\\something\\there.js', '<DRIVE_D>/something/there.js'],

    // Home directory normalization
    ['macOS home', '/Users/john/project/file.js', '<HOME>/project/file.js'],
    ['Linux home', '/home/jane/work/app.js', '<HOME>/work/app.js'],
    ['root home', '/root/.config/app.js', '<HOME>/.config/app.js'],
    ['Windows home old', '/Documents and Settings/user/file.js', '<HOME>/file.js'],

    // Windows AppData paths
    [
      'Windows AppData Roaming',
      '/Users/LENOVO/AppData/Roaming/npm/node_modules/@shopify/cli/dist/chunk-AE3MLJMV.js',
      '<GLOBAL_NPM>/@shopify/cli/dist/chunk-<HASH>.js',
    ],
    ['Windows AppData Local', '/Users/john/AppData/Local/Programs/app.js', '<HOME>/AppData/Local/Programs/app.js'],
    ['Windows AppData Temp', '/Users/john/AppData/Local/Temp/test.js', '<TEMP>/test.js'],

    // Temp directory normalization
    ['Unix tmp', '/tmp/build/app.js', '<TEMP>/build/app.js'],
    ['macOS temp folders', '/var/folders/zz/zyxvpxvq6csfxvn_n0000000000000/T/test.js', '<TEMP>/test.js'],
    ['Already normalized home temp', '<HOME>/AppData/Local/Temp/file.js', '<TEMP>/file.js'],

    // Global package manager paths
    ['npm global unix', '/usr/local/lib/node_modules/@shopify/cli/index.js', '<GLOBAL_NPM>/@shopify/cli/index.js'],
    ['npm global linux', '/usr/lib/node_modules/typescript/lib/tsc.js', '<GLOBAL_NPM>/typescript/lib/tsc.js'],
    ['npm custom global', '<HOME>/.npm-global/lib/node_modules/eslint/index.js', '<GLOBAL_NPM>/eslint/index.js'],
    ['yarn cache', '<HOME>/.yarn/berry/cache/package.js', '<YARN_CACHE>/package.js'],
    ['yarn global', '<HOME>/.config/yarn/global/node_modules/prettier/index.js', '<GLOBAL_YARN>/prettier/index.js'],
    ['pnpm store', '<HOME>/.pnpm-store/package.js', '<PNPM_STORE>/package.js'],
    [
      'pnpm global',
      '<HOME>/.local/share/pnpm/global/5/node_modules/@shopify/cli/index.js',
      '<GLOBAL_PNPM>/@shopify/cli/index.js',
    ],

    // Webpack chunk hash normalization
    ['webpack chunk uppercase', '@shopify/cli/dist/chunk-AE3MLJMV.js', '@shopify/cli/dist/chunk-<HASH>.js'],
    ['webpack chunk lowercase', 'dist/chunk.1a2b3c4d.js', 'dist/chunk.<HASH>.js'],
    ['webpack chunk long hash', 'bundle.chunk.abcdef1234567890.js', 'bundle.chunk.<HASH>.js'],

    // Other hash patterns
    ['js file with hash', 'dist/main.12345678.js', 'dist/main.<HASH>.js'],
    ['mjs file with hash', 'lib/module.abcdef12.mjs', 'lib/module.<HASH>.mjs'],
    ['ts file with long hash', 'src/component.1234567890abcdef.ts', 'src/component.<HASH>.ts'],

    // CI/CD environments
    [
      'GitHub Actions',
      '/home/runner/work/shopify-cli/shopify-cli/packages/cli-kit/src/error.js',
      '<CI_WORKSPACE>/packages/cli-kit/src/error.js',
    ],
    ['GitHub workspace', '/github/workspace/src/index.js', '<CI_WORKSPACE>/src/index.js'],
    ['Netlify', '/opt/build/repo/dist/app.js', '<CI_WORKSPACE>/dist/app.js'],
    ['GitLab CI', '/builds/group/project/src/main.js', '<CI_WORKSPACE>/src/main.js'],

    // Complex real-world examples
    [
      'Global npm Windows path from issue',
      '/Users/LENOVO/AppData/Roaming/npm/node_modules/@shopify/cli/dist/chunk-H44KHRQ3.js',
      '<GLOBAL_NPM>/@shopify/cli/dist/chunk-<HASH>.js',
    ],
    ['Local installation', '@shopify/cli/dist/chunk-H44KHRQ3.js', '@shopify/cli/dist/chunk-<HASH>.js'],

    // Path separator normalization
    ['Windows backslashes', 'C:\\Users\\john\\project\\src\\file.js', '<DRIVE_C>/Users/john/project/src/file.js'],
    ['Mixed separators', '/Users/john\\work/project\\file.js', '<HOME>/work/project/file.js'],

    // Additional CI/CD environments
    ['Bitbucket Pipelines', '/bitbucket/pipelines/agent/build/src/index.js', '<CI_WORKSPACE>/src/index.js'],
    ['AWS CodeBuild', '/codebuild/output/src123/src/app.js', '<CI_WORKSPACE>/src/app.js'],

    // Container environments
    ['Docker /app', '/app/src/components/Button.js', '<CONTAINER>/src/components/Button.js'],
    ['Docker /workspace', '/workspace/lib/utils.js', '<CONTAINER>/lib/utils.js'],
    ['Docker /usr/src/app', '/usr/src/app/index.js', '<CONTAINER>/index.js'],

    // Version numbers in paths
    [
      'pnpm with version',
      'node_modules/.pnpm/react@18.2.0/node_modules/react/index.js',
      'node_modules/.pnpm/react@<VERSION>/node_modules/react/index.js',
    ],
    [
      'npm scoped package',
      'node_modules/@shopify/cli@3.45.0/dist/index.js',
      'node_modules/@shopify/cli@<VERSION>/dist/index.js',
    ],

    // UUID normalization
    ['UUID in path', '/tmp/a1b2c3d4-e5f6-7890-abcd-ef1234567890/file.js', '<TEMP>/<UUID>/file.js'],
    ['Uppercase UUID', '/var/A1B2C3D4-E5F6-7890-ABCD-EF1234567890/app.js', '/var/<UUID>/app.js'],
  ])('%s: %s -> %s', (_, input, expected) => {
    expect(cleanSingleStackTracePath(input)).toEqual(expected)
  })

  // Security tests
  test('handles path traversal attempts', () => {
    // After sanitization: /Users/../../../etc/passwd removes all ../ -> /etc/passwd
    expect(cleanSingleStackTracePath('/Users/../../../etc/passwd')).toBe('/etc/passwd')
    // After sanitization: /home/user/../../etc/shadow removes all ../ -> /etc/shadow
    expect(cleanSingleStackTracePath('/home/user/../../etc/shadow')).toBe('/etc/shadow')
  })

  test('handles extremely long paths', () => {
    const longPath = `/Users/john/${'a'.repeat(2000)}/file.js`
    const result = cleanSingleStackTracePath(longPath)
    expect(result.length).toBeLessThanOrEqual(1003)
    expect(result).toMatch(/\.\.\.$/)
  })

  test('preserves drive letters', () => {
    expect(cleanSingleStackTracePath('C:/Users/john/file.js')).toBe('<DRIVE_C>/Users/john/file.js')
    expect(cleanSingleStackTracePath('D:/Projects/app.js')).toBe('<DRIVE_D>/Projects/app.js')
  })

  // Edge case tests
  test('handles end-of-path UUIDs', () => {
    expect(cleanSingleStackTracePath('/tmp/build-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('<TEMP>/build-<UUID>')
  })

  test('handles end-of-path versions', () => {
    expect(cleanSingleStackTracePath('node_modules/@shopify/cli@3.45.0')).toBe('node_modules/@shopify/cli@<VERSION>')
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
