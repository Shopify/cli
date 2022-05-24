import {extensionConfig, ExtensionConfigOptions} from './configuration'
import {App, UIExtension} from '../../models/app/app'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {path} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      ui: {
        prompt: vi.fn(),
      },
      id: {
        generateShortId: () => 'id',
      },
    }
  })
  vi.mock('./cli', async () => {
    return {
      nodeExtensionsCLIPath: () => 'node-path',
    }
  })
  vi.mock('../../models/app/app', async () => {
    return {
      getUIExtensionRendererVersion: () => 'renderer-version',
    }
  })
})
describe('extensionConfig', () => {
  test('delegates the build to the Go binary', async () => {
    // Given
    const appRoot = '/'
    const extensionName = 'myextension'
    const extensionRoot = `/extensions/${extensionName}`
    const extension: UIExtension = {
      localIdentifier: extensionName,
      idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      buildDirectory: `${extensionRoot}/build`,
      configurationPath: path.join(appRoot, 'shopify.app.toml'),
      configuration: {
        name: extensionName,
        metafields: [],
        type: 'checkout_post_purchase',
      },
      directory: extensionRoot,
      entrySourceFilePath: `${extensionRoot}/src/index.js`,
    }
    const app: App = {
      idEnvironmentVariableName: 'SHOPIFY_APP_ID',
      directory: appRoot,
      dependencyManager: 'yarn',
      configurationPath: path.join(appRoot, 'shopify.app.toml'),
      configuration: {
        name: 'myapp',
        scopes: '',
      },
      webs: [],
      nodeDependencies: {},
      environment: {
        dotenv: {},
        env: {},
      },
      extensions: {ui: [extension], function: [], theme: []},
    }

    const options: ExtensionConfigOptions = {
      app,
      apiKey: 'apiKey',
      extensions: [extension],
      buildDirectory: '',
      url: 'url',
      port: 8000,
      storeFqdn: 'storeFqdn',
    }

    // When
    const got = await extensionConfig(options)
    // console.log(JSON.stringify(got, null, 2))

    // Then
    expect(got).toEqual({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      public_url: 'url',
      port: 8000,
      store: 'storeFqdn',
      app: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        api_key: 'apiKey',
      },
      extensions: [
        {
          uuid: 'myextension-id',
          title: 'myextension',
          type: 'checkout_post_purchase',
          metafields: [],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          node_executable: 'node-path',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          extension_points: [],
          development: {
            version: '1.0.0',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            root_dir: 'extensions/myextension',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            build_dir: 'build',
            entries: {
              main: 'src/index.js',
            },
            renderer: 'renderer-version',
          },
        },
      ],
    })
  })
})
