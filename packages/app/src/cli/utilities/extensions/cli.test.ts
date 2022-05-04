import {runGoExtensionsCLI, nodeExtensionsCLIPath} from './cli'
import {getBinaryPathOrDownload} from './binary'
import {useExtensionsCLISources} from '../../environment'
import {describe, test, expect, vi} from 'vitest'
import {system, environment, path} from '@shopify/cli-kit'

vi.mock('../../environment')
vi.mock('./binary')
vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    system: {
      exec: vi.fn(),
    },
    environment: {
      local: {
        homeDirectory: vi.fn(),
      },
    },
  }
})

describe('runGoExtensionsCLI', () => {
  test('runs the CLI through Make when using the local sources', async () => {
    // Given
    const projectDirectory = '/home/src/github.com/shopify/shopify-cli-extensions'
    vi.mocked(useExtensionsCLISources).mockReturnValue(true)
    vi.mocked(environment.local.homeDirectory).mockReturnValue('/home')

    // When
    const stdout: any = {write: vi.fn()}
    const got = await runGoExtensionsCLI(['build'], {stdout})

    // Then
    expect(system.exec).toHaveBeenNthCalledWith(1, 'make', ['build'], {
      stdout: undefined,
      stderr: undefined,
      cwd: projectDirectory,
    })
    expect(system.exec).toHaveBeenNthCalledWith(2, path.join(projectDirectory, 'shopify-extensions'), ['build'], {
      stdout,
    })
  })

  test('runs the CLI through the downloaded binary when not using the local sources', async () => {
    // Given
    const binaryPath = '/path/to/binary'
    vi.mocked(useExtensionsCLISources).mockReturnValue(false)
    vi.mocked(getBinaryPathOrDownload).mockResolvedValue(binaryPath)

    // When
    const got = await runGoExtensionsCLI(['build'])

    // Then
    expect(system.exec).toHaveBeenCalledWith(binaryPath, ['build'], {})
  })
})

describe('nodeExtensionsCLIPath', () => {
  test('returns the path', async () => {
    // When
    const got = await nodeExtensionsCLIPath()

    // Then
    expect(got).not.toBeUndefined()
  })
})
