import {buildExtension} from './extension'
import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {describe, expect, test, vi} from 'vitest'
import {yaml, path} from '@shopify/cli-kit'
import {App, UIExtension} from '$cli/models/app/app'

vi.mock('../../utilities/extensions/cli')

describe('buildExtension', () => {
  test('delegates the build to the Go binary', async () => {
    // Given
    const stdout: any = {write: vi.fn()}
    const stderr: any = vi.fn()
    const signal: any = vi.fn()
    const appRoot = '/'
    const extensionName = 'myextension'
    const extensionRoot = `/extensions/${extensionName}`
    const extension: UIExtension = {
      buildDirectory: `${extensionRoot}/build`,
      configuration: {
        name: extensionName,
        metafields: [],
        type: 'checkout_post_purchase',
      },
      directory: extensionRoot,
      entrySourceFilePath: `${extensionRoot}/src/index.js`,
    }
    const app: App = {
      directory: appRoot,
      packageManager: 'yarn',
      configuration: {
        name: 'myapp',
        scopes: '',
      },
      homes: [],
      extensions: {ui: [extension], function: [], theme: []},
    }

    // When
    await buildExtension(extension, app, {stdout, stderr, signal})

    // Then
    expect(runGoExtensionsCLI).toHaveBeenCalled()
    const calls = (runGoExtensionsCLI as any).calls
    const [command, options] = calls[0]
    expect(command).toEqual(['build', '-'])
    expect(options.stdout).toBe(stdout)
    expect(options.stderr).toBe(stderr)
    const stdinObject = yaml.decode(options.stdin)
    expect(stdinObject).toEqual({
      extensions: [
        {
          title: extension.configuration.name,
          type: `${extension.configuration.type}_next`,
          metafields: extension.configuration.metafields,
          development: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            root_dir: path.relative(appRoot, extensionRoot),
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
