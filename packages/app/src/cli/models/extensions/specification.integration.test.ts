import {loadLocalExtensionsSpecifications} from './load-specifications.js'
import {
  configWithoutFirstClassFields,
  createContractBasedModuleSpecification,
  createConfigExtensionSpecification,
  createExtensionSpecification,
} from './specification.js'
import {BaseSchema} from './schemas.js'
import {ClientSteps} from '../../services/build/client-steps.js'
import {AppSchema} from '../app/app.js'
import {describe, test, expect, beforeAll} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

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

describe('contributeToAppConfigurationSchema', () => {
  test('contract-based config spec with zod.any() contributes its identifier as a known key', () => {
    // Given: A contract-based config spec with experience: 'configuration' and zod.any() schema
    const spec = createContractBasedModuleSpecification({
      identifier: 'purchase_options',
      uidStrategy: 'single',
      experience: 'configuration',
      appModuleFeatures: () => [],
    })

    // When: It contributes to the app configuration schema
    const baseSchema = zod.object({client_id: zod.string()})
    const result = spec.contributeToAppConfigurationSchema(baseSchema)

    // Then: The resulting schema should accept the identifier as a valid key
    const parsed = result.safeParse({client_id: 'test', purchase_options: {bundles: true}})
    expect(parsed.success).toBe(true)
  })

  test('contract-based config spec with experience: extension does not contribute to schema', () => {
    // Given: A contract-based spec with experience: 'extension' (not 'configuration')
    const spec = createContractBasedModuleSpecification({
      identifier: 'some_extension',
      uidStrategy: 'uuid',
      experience: 'extension',
      appModuleFeatures: () => [],
    })

    // When: It tries to contribute to the app configuration schema
    const baseSchema = zod.object({client_id: zod.string()}).strict()
    const result = spec.contributeToAppConfigurationSchema(baseSchema)

    // Then: The schema should be unchanged — 'some_extension' is not accepted
    const parsed = result.safeParse({client_id: 'test', some_extension: {enabled: true}})
    expect(parsed.success).toBe(false)
  })

  test('config spec with explicit zod schema merges its schema shape', () => {
    // Given: A locally-defined config spec with an explicit zod schema
    const spec = createConfigExtensionSpecification({
      identifier: 'test_config',
      schema: BaseSchema.extend({
        my_section: zod.object({enabled: zod.boolean()}).optional(),
      }),
      transformConfig: {},
    })

    // When: It contributes to the app configuration schema
    const baseSchema = zod.object({client_id: zod.string()})
    const result = spec.contributeToAppConfigurationSchema(baseSchema)

    // Then: The schema should accept 'my_section' as a valid key
    const parsed = result.safeParse({client_id: 'test', my_section: {enabled: true}})
    expect(parsed.success).toBe(true)
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
