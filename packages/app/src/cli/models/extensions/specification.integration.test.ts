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
        id: 'copy_static',
        name: 'Copy static assets',
        type: 'copy_static_assets',
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
