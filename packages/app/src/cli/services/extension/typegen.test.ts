import {buildGraphqlTypes} from './typegen.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {packageManagerBinaryCommandForDirectory} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/node-package-manager', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/node-package-manager')
  return {
    ...actual,
    packageManagerBinaryCommandForDirectory: vi.fn(),
  }
})

let stdout: any
let stderr: any
let signal: any

beforeEach(() => {
  stderr = {write: vi.fn()}
  stdout = {write: vi.fn()}
  signal = vi.fn()
  vi.mocked(packageManagerBinaryCommandForDirectory).mockResolvedValue({
    command: 'npm',
    args: ['exec', '--', 'graphql-code-generator', '--config', 'package.json'],
  })
})

describe('buildGraphqlTypes', () => {
  test('generates types by running graphql-code-generator in the extension directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = {directory: tmpDir}

      // When
      const got = buildGraphqlTypes(extension, {stdout, stderr, signal})

      // Then
      await expect(got).resolves.toBeUndefined()
      expect(packageManagerBinaryCommandForDirectory).toHaveBeenCalledWith(
        extension.directory,
        'graphql-code-generator',
        '--config',
        'package.json',
      )
      expect(exec).toHaveBeenCalledWith('npm', ['exec', '--', 'graphql-code-generator', '--config', 'package.json'], {
        cwd: extension.directory,
        stderr,
        signal,
      })
    })
  })
})
