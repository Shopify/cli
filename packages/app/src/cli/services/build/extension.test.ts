import {buildExtension} from './extension'
import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {describe, expect, test, vi} from 'vitest'
import {yaml, path} from '@shopify/cli-kit'

vi.mock('../../utilities/extensions/cli')

describe('buildExtension', () => {
  test('delegates the build to the Go binary', async () => {
    // Given
    const stdout: any = {write: vi.fn()}
    const stderr: any = vi.mocked(vi.fn())
    const signal: any = vi.fn()
    const extension = {
      buildDirectory: '',
      configuration: {
        name: 'name',
        metafields: [],
        type: 'checkout_post_purchase',
      },
      directory: '/',
      entrySourceFilePath: '/',
    }

    // When
    await buildExtension(extension, {stdout, stderr, signal})

    // Then
    expect(vi.mocked(runGoExtensionsCLI)).toHaveBeenCalled()
    const calls = (vi.mocked(runGoExtensionsCLI) as any).calls
    const [command, options] = calls[0]
    expect(command).toEqual(['build', '-'])
    expect(options.stdout).toBe(stdout)
    expect(options.stderr).toBe(stderr)
    const stdinObject = yaml.decode(options.stdin)
    expect(stdinObject).toEqual({
      extensions: [
        {
          title: extension.configuration.name,
          type: extension.configuration.type,
          metafields: extension.configuration.metafields,
          development: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            root_dir: '.',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            build_dir: path.relative(extension.directory, extension.buildDirectory),
            entries: {
              main: path.relative(extension.directory, extension.entrySourceFilePath),
            },
          },
        },
      ],
    })
  })
})
