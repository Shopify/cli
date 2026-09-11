import {loadLocalExtensionsSpecifications} from './load-specifications.js'
import {
  configWithoutFirstClassFields,
  createContractBasedModuleSpecification,
  createConfigExtensionSpecification,
  createExtensionSpecification,
} from './specification.js'
import {BaseConfigType, BaseSchema} from './schemas.js'
import {placeholderAppConfiguration} from '../app/app.test-data.js'
import {ClientSteps} from '../../services/build/client-steps.js'
import {AppSchema} from '../app/app.js'
import {describe, test, expect, beforeAll} from 'vitest'

// If the AppSchema is not instanced, the dynamic loading of loadLocalExtensionsSpecifications is not working
beforeAll(() => {
  const schema = AppSchema
})

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadLocalExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allLocalSpecs', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadLocalExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

const testClientSteps: ClientSteps = [
  {
    lifecycle: 'deploy',
    steps: [
      {
        id: 'bundle-ui',
        name: 'Bundle UI Extension',
        type: 'bundle_ui',
      },
    ],
  },
]

describe('createContractBasedModuleSpecification', () => {
  test('creates a specification with the given identifier', () => {
    // When
    const got = createContractBasedModuleSpecification({
      identifier: 'test',
      uidStrategy: 'uuid',
      experience: 'extension',
      appModuleFeatures: () => ['localization'],
    })

    // Then
    expect(got).toMatchObject(
      expect.objectContaining({
        identifier: 'test',
        experience: 'extension',
        uidStrategy: 'uuid',
      }),
    )
    expect(got.appModuleFeatures()).toEqual(['localization'])
  })

  test('passes clientSteps through to the created specification', () => {
    // When
    const got = createContractBasedModuleSpecification({
      identifier: 'channel_config',
      uidStrategy: 'uuid',
      experience: 'extension',
      appModuleFeatures: () => [],
      clientSteps: testClientSteps,
    })

    // Then
    expect(got.clientSteps).toEqual(testClientSteps)
  })

  test('clientSteps is undefined when not provided', () => {
    // When
    const got = createContractBasedModuleSpecification({
      identifier: 'test',
      uidStrategy: 'uuid',
      experience: 'extension',
      appModuleFeatures: () => [],
    })

    // Then
    expect(got.clientSteps).toBeUndefined()
  })

  describe('app relative URLs', () => {
    interface LifecycleCallbackConfig extends BaseConfigType {
      url: string
    }

    const lifecycleCallbackSpec = () =>
      createContractBasedModuleSpecification<LifecycleCallbackConfig>({
        identifier: 'flow_trigger_lifecycle_callback',
        uidStrategy: 'uuid',
        experience: 'extension',
        appModuleFeatures: () => [],
      })

    test('resolves a relative url against the application URL when deploying', async () => {
      // Given
      const spec = lifecycleCallbackSpec()

      // When
      const got = await spec.deployConfig!(
        {type: 'flow_trigger_lifecycle_callback', name: 'Auction lifecycle', url: '/api/flow/lifecycle'},
        './my-extension',
        'api-key',
        undefined,
        {
          appConfiguration: {...placeholderAppConfiguration, application_url: 'https://my-app.example.com'},
        },
      )

      // Then
      expect(got).toEqual({name: 'Auction lifecycle', url: 'https://my-app.example.com/api/flow/lifecycle'})
    })

    test('leaves an absolute url untouched when deploying', async () => {
      // Given
      const spec = lifecycleCallbackSpec()

      // When
      const got = await spec.deployConfig!(
        {
          type: 'flow_trigger_lifecycle_callback',
          name: 'Auction lifecycle',
          url: 'https://my-prod-host.example.com/api/flow/lifecycle',
        },
        './my-extension',
        'api-key',
        undefined,
        {
          appConfiguration: {...placeholderAppConfiguration, application_url: 'https://my-app.example.com'},
        },
      )

      // Then
      expect(got).toEqual({
        name: 'Auction lifecycle',
        url: 'https://my-prod-host.example.com/api/flow/lifecycle',
      })
    })

    test('resolves a relative url against the dev tunnel URL', () => {
      // Given
      const spec = lifecycleCallbackSpec()
      const config = {type: 'flow_trigger_lifecycle_callback', name: 'Auction lifecycle', url: '/api/flow/lifecycle'}

      // When
      spec.patchWithAppDevURLs!(config, {applicationUrl: 'https://my-tunnel.example.com', redirectUrlWhitelist: []})

      // Then
      expect(config.url).toBe('https://my-tunnel.example.com/api/flow/lifecycle')
    })

    test('leaves a contract module without relative URL fields untouched', async () => {
      // Given
      const spec = createContractBasedModuleSpecification<LifecycleCallbackConfig>({
        identifier: 'test',
        uidStrategy: 'uuid',
        experience: 'extension',
        appModuleFeatures: () => [],
      })

      // When
      const got = await spec.deployConfig!({type: 'test', url: '/api/something'}, './my-extension', 'api-key')

      // Then
      expect(got).toEqual({url: '/api/something'})
    })
  })
})

describe('createExtensionSpecification', () => {
  test('passes clientSteps through to the created specification', () => {
    // When
    const got = createExtensionSpecification({
      identifier: 'test_extension',
      appModuleFeatures: () => [],
      clientSteps: testClientSteps,
    })

    // Then
    expect(got.clientSteps).toEqual(testClientSteps)
  })
})

describe('createConfigExtensionSpecification', () => {
  test('passes clientSteps through to the created specification', () => {
    // When
    const got = createConfigExtensionSpecification({
      identifier: 'test_config',
      schema: BaseSchema,
      transformConfig: {},
      clientSteps: testClientSteps,
    })

    // Then
    expect(got.clientSteps).toEqual(testClientSteps)
  })
})

describe('configWithoutFirstClassFields', () => {
  test('removes the first class fields from the config', () => {
    // When
    const got = configWithoutFirstClassFields({
      type: 'test',
      handle: 'test',
      uid: 'test',
      path: 'test',
      extensions: [{type: 'test', handle: 'test', uid: 'test', path: 'test'}],
      config: {
        test: 'test',
      },
      other: 'other',
    })

    // Then
    expect(got).toEqual({
      config: {
        test: 'test',
      },
      other: 'other',
    })
  })
})
