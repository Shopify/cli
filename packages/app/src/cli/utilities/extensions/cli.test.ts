import {runExtensionsCLI} from './cli'
import {getBinaryPathOrDownload} from './binary'
import {useExtensionsCLISources} from '../../environment'
import {describe, test, expect, vi} from 'vitest'
import {system} from '@shopify/cli-kit'

vi.mock('../../environment')
vi.mock('./binary')
vi.mock('@shopify/cli-kit')

describe('runExtensionsCLI', () => {
  test('runs the CLI through Make when using the local sources', async () => {
    // Given
    const projectDirectory = '/path/to/shopify-cli-extensions'
    vi.mocked(useExtensionsCLISources).mockReturnValue(true)
    vi.mocked(system.captureOutput).mockResolvedValue(projectDirectory)

    // When
    const got = await runExtensionsCLI(['build'])

    // Then
    expect(vi.mocked(system.captureOutput)).toHaveBeenCalledWith('/opt/dev/bin/dev', [
      'project-path',
      'shopify-cli-extensions',
    ])
    expect(vi.mocked(system.exec)).toHaveBeenCalledWith('make', ['run', 'build'], {...{}, cwd: projectDirectory})
  })

  test('runs the CLI through the downloaded binary when not using the local sources', async () => {
    // Given
    const binaryPath = '/path/to/binary'
    vi.mocked(useExtensionsCLISources).mockReturnValue(false)
    vi.mocked(getBinaryPathOrDownload).mockResolvedValue(binaryPath)

    // When
    const got = await runExtensionsCLI(['build'])

    // Then
    expect(vi.mocked(system.exec)).toHaveBeenCalledWith(binaryPath, ['build'], {...{}})
  })
})
