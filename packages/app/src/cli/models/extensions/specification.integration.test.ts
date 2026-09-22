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
import {AbortError} from '@shopify/cli-kit/node/error'
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
    interface CallbackConfig extends BaseConfigType {
      url: string
      other_url?: string
    }

    const callbackSpec = () =>
      createContractBasedModuleSpecification<CallbackConfig>({
        identifier: 'test_callback',
        uidStrategy: 'uuid',
        experience: 'extension',
        appModuleFeatures: () => [],
        appRelativeUrlFields: ['url'],
      })

    test('resolves declared deployment URLs without mutating the original configuration', async () => {
      const spec = callbackSpec()
      const config = {type: 'test_callback', url: '/callback', other_url: '/leave-alone'}

      const got = await spec.deployConfig!(config, './my-extension', 'api-key', undefined, {
        appConfiguration: {...placeholderAppConfiguration, application_url: 'https://my-app.example.com'},
      })

      expect(got).toEqual({url: 'https://my-app.example.com/callback', other_url: '/leave-alone'})
      expect(config).toEqual({type: 'test_callback', url: '/callback', other_url: '/leave-alone'})
    })

    test('leaves an absolute deployment URL untouched without app configuration', async () => {
      const spec = callbackSpec()

      const got = await spec.deployConfig!(
        {type: 'test_callback', url: 'https://my-prod-host.example.com/callback'},
        './my-extension',
        'api-key',
      )

      expect(got).toEqual({url: 'https://my-prod-host.example.com/callback'})
    })

    test('resolves declared URLs against the dev tunnel URL', () => {
      const spec = callbackSpec()
      const config = {type: 'test_callback', url: '/callback', other_url: '/leave-alone'}

      spec.patchWithAppDevURLs!(config, {applicationUrl: 'https://my-tunnel.example.com', redirectUrlWhitelist: []})

      expect(config).toEqual({
        type: 'test_callback',
        url: 'https://my-tunnel.example.com/callback',
        other_url: '/leave-alone',
      })
    })

    test.each([
      {appRelativeUrlFields: undefined, description: 'omitted'},
      {appRelativeUrlFields: [], description: 'empty'},
    ])('does not opt in by identifier when URL fields are $description', async ({appRelativeUrlFields}) => {
      const spec = createContractBasedModuleSpecification<CallbackConfig>({
        identifier: 'flow_trigger_lifecycle_callback',
        uidStrategy: 'uuid',
        experience: 'extension',
        appModuleFeatures: () => [],
        appRelativeUrlFields,
      })
      const config = {type: 'flow_trigger_lifecycle_callback', url: '/callback'}

      spec.patchWithAppDevURLs?.(config, {applicationUrl: 'https://my-tunnel.example.com', redirectUrlWhitelist: []})
      const got = await spec.deployConfig!(config, './my-extension', 'api-key', undefined, {
        appConfiguration: {...placeholderAppConfiguration, application_url: 'https://my-app.example.com'},
      })

      expect(config).toEqual({type: 'flow_trigger_lifecycle_callback', url: '/callback'})
      expect(got).toEqual({url: '/callback'})
    })

    test('rejects a relative deployment URL without app configuration', async () => {
      const spec = callbackSpec()

      await expect(
        spec.deployConfig!({type: 'test_callback', url: '/callback'}, './my-extension', 'api-key'),
      ).rejects.toThrow(AbortError)
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
