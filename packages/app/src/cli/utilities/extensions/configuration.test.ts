import {extensionConfig, ExtensionConfigOptions} from './configuration.js'
import {AppInterface} from '../../models/app/app.js'
import {UIExtension} from '../../models/app/extensions.js'
import {testApp} from '../../models/app/app.test-data.js'
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
    const appOriginal: any = await vi.importActual('../../models/app/app.js')
    return {
      ...appOriginal,
      getUIExtensionRendererVersion: () => {
        return {name: 'renderer-name', version: '2.1.5'}
      },
    }
  })
})
describe('extensionConfig', () => {
  test('creates config for the go binary', async () => {
    // Given
    const appRoot = '/'
    const extensionName = 'my extension'
    const extensionRoot = `/extensions/${extensionName}`
    const extension: UIExtension = {
      localIdentifier: extensionName,
      idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      buildDirectory: `${extensionRoot}/build`,
      configurationPath: path.join(appRoot, 'shopify.app.toml'),
      configuration: {
        name: 'My Extension Name',
        metafields: [],
        type: 'checkout_post_purchase',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        capabilities: {network_access: true},
      },
      type: 'checkout_post_purchase',
      graphQLType: 'CHECKOUT_POST_PURCHASE',
      directory: extensionRoot,
      entrySourceFilePath: `${extensionRoot}/src/index.js`,
      devUUID: 'devUUID',
    }
    const app: AppInterface = testApp({
      name: 'myapp',
      directory: appRoot,
      configurationPath: path.join(appRoot, 'shopify.app.toml'),
      nodeDependencies: {},
      extensions: {ui: [extension], function: [], theme: []},
    })

    const options: ExtensionConfigOptions = {
      app,
      apiKey: 'apiKey',
      extensions: [extension],
      buildDirectory: '',
      url: 'url',
      port: 8000,
      storeFqdn: 'storeFqdn',
      includeResourceURL: true,
    }

    // When
    const got = await extensionConfig(options)

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
          uuid: 'devUUID',
          title: 'My Extension Name',
          type: 'checkout_post_purchase',
          version: '2.1.5',
          metafields: [],
          surface: 'post_purchase',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          node_executable: 'node-path',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          extension_points: [],
          development: {
            build: {env: {}},
            develop: {env: {}},
            // eslint-disable-next-line @typescript-eslint/naming-convention
            root_dir: 'extensions/my extension',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            build_dir: 'build',
            entries: {
              main: 'src/index.js',
            },
            resource: {url: 'invalid_url'},
            renderer: {
              name: 'renderer-name',
              version: '2.1.5',
            },
          },
          // eslint-disable-next-line @typescript-eslint/naming-convention
          capabilities: {network_access: true},
        },
      ],
    })
  })
})
