import {loadLocalExtensionsSpecifications} from './load-specifications.js'
import {
  configWithoutFirstClassFields,
  createConfigExtensionSpecification,
  createContractBasedModuleSpecification,
} from './specification.js'
import {BaseSchemaWithoutHandle} from './schemas.js'
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

describe('createContractBasedModuleSpecification', () => {
  test('creates a specification with the given identifier', () => {
    // When
    const got = createContractBasedModuleSpecification({
      identifier: 'test',
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
})

describe('createConfigExtensionSpecification', () => {
  const TestSchema = BaseSchemaWithoutHandle.extend({
    name: zod.string().optional(),
    handle: zod.string().optional(),
  })

  test('derives transforms from transformConfig when direct params are not provided', () => {
    const spec = createConfigExtensionSpecification({
      identifier: 'test-module',
      schema: TestSchema,
      transformConfig: {server_name: 'name'},
    })

    // Forward transform maps TOML field names to server field names
    const transformed = spec.transformLocalToRemote!({name: 'My App'}, {} as any)
    expect(transformed).toEqual({server_name: 'My App'})

    // Reverse transform maps server field names back to TOML
    const reversed = spec.transformRemoteToLocal!({server_name: 'My App'})
    expect(reversed).toEqual({name: 'My App'})

    expect(spec.experience).toBe('configuration')
    expect(spec.uidStrategy).toBe('single')
  })

  test('uses deployConfig and transformRemoteToLocal directly when provided without transformConfig', () => {
    const spec = createConfigExtensionSpecification({
      identifier: 'test-module',
      schema: TestSchema,
      deployConfig: async (config) => ({name: (config as any).name}),
      transformRemoteToLocal: (content: object) => ({
        name: (content as any).server_name,
      }),
    })

    // No forward transform — deployConfig handles the deploy path instead
    expect(spec.transformLocalToRemote).toBeUndefined()

    // Reverse transform is the directly provided function
    const reversed = spec.transformRemoteToLocal!({server_name: 'My App'})
    expect(reversed).toEqual({name: 'My App'})

    // deployConfig is set
    expect(spec.deployConfig).toBeDefined()
  })

  test('direct params take precedence over transformConfig-derived values', () => {
    const directForward = (obj: object) => ({overridden: true})
    const directReverse = (obj: object) => ({overridden: true})

    const spec = createConfigExtensionSpecification({
      identifier: 'test-module',
      schema: TestSchema,
      transformConfig: {server_name: 'name'},
      transformLocalToRemote: directForward,
      transformRemoteToLocal: directReverse,
    })

    // Direct params win over transformConfig-derived values
    expect(spec.transformLocalToRemote!({name: 'test'}, {} as any)).toEqual({overridden: true})
    expect(spec.transformRemoteToLocal!({server_name: 'test'})).toEqual({overridden: true})
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
