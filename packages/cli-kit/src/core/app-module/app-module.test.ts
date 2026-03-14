import {AppModule, contentHashIdentity} from './app-module.js'
import {ModuleSpecification} from '../module-specification/module-specification.js'
import {Contract} from '../contract/contract.js'
import {describe, expect, test} from 'vitest'

function specWithContract(
  contract?: Contract,
  overrides: Partial<ConstructorParameters<typeof ModuleSpecification>[0]> = {},
): ModuleSpecification {
  return new ModuleSpecification({
    identifier: 'test_spec',
    name: 'Test',
    externalIdentifier: 'test_spec_external',
    contract,
    appModuleLimit: 1,
    uidIsClientProvided: false,
    features: [],
    ...overrides,
  })
}

describe('AppModule', () => {
  describe('construction', () => {
    test('deep copies config', () => {
      const config = {name: 'hello', nested: {value: 42}}
      const mod = new AppModule({
        spec: specWithContract(),
        config,
        sourcePath: '/tmp/shopify.app.toml',
      })

      config.name = 'mutated'
      ;(config.nested as {value: number}).value = 0

      expect(mod.config.name).toBe('hello')
      expect((mod.config.nested as {value: number}).value).toBe(42)
    })

    test('preserves sourcePath', () => {
      const mod = new AppModule({
        spec: specWithContract(),
        config: {name: 'test'},
        sourcePath: '/tmp/extensions/my-ext/shopify.extension.toml',
      })
      expect(mod.sourcePath).toBe('/tmp/extensions/my-ext/shopify.extension.toml')
    })

    test('preserves directory and entryPath when provided', () => {
      const mod = new AppModule({
        spec: specWithContract(),
        config: {},
        sourcePath: '/tmp/ext.toml',
        directory: '/tmp/extensions/my-ext',
        entryPath: '/tmp/extensions/my-ext/src/index.ts',
      })
      expect(mod.directory).toBe('/tmp/extensions/my-ext')
      expect(mod.entryPath).toBe('/tmp/extensions/my-ext/src/index.ts')
    })
  })

  describe('validation state', () => {
    test('starts as unvalidated', () => {
      const mod = new AppModule({
        spec: specWithContract(),
        config: {},
        sourcePath: '/tmp/app.toml',
      })
      expect(mod.isUnvalidated).toBe(true)
      expect(mod.isValid).toBe(false)
      expect(mod.isInvalid).toBe(false)
      expect(mod.errors).toHaveLength(0)
    })

    test('transitions to valid when contract passes', async () => {
      const contract = await Contract.fromJsonSchema(
        JSON.stringify({type: 'object', properties: {name: {type: 'string'}}}),
      )
      const mod = new AppModule({
        spec: specWithContract(contract),
        config: {name: 'hello'},
        sourcePath: '/tmp/app.toml',
      })

      const state = mod.validate()
      expect(state.status).toBe('valid')
      expect(mod.isValid).toBe(true)
      expect(mod.isInvalid).toBe(false)
    })

    test('transitions to invalid when contract fails', async () => {
      const contract = await Contract.fromJsonSchema(
        JSON.stringify({
          type: 'object',
          properties: {name: {type: 'string'}},
          required: ['name'],
          additionalProperties: false,
        }),
      )
      const mod = new AppModule({
        spec: specWithContract(contract),
        config: {wrong_field: 'oops'},
        sourcePath: '/tmp/app.toml',
      })

      const state = mod.validate()
      expect(state.status).toBe('invalid')
      expect(mod.isInvalid).toBe(true)
      expect(mod.errors.length).toBeGreaterThan(0)
    })

    test('is valid when spec has no contract', () => {
      const mod = new AppModule({
        spec: specWithContract(undefined),
        config: {anything: 'goes'},
        sourcePath: '/tmp/app.toml',
      })

      mod.validate()
      expect(mod.isValid).toBe(true)
    })

    test('second validate call returns same state (idempotent)', async () => {
      const contract = await Contract.fromJsonSchema(
        JSON.stringify({type: 'object', properties: {name: {type: 'string'}}}),
      )
      const mod = new AppModule({
        spec: specWithContract(contract),
        config: {name: 'hello'},
        sourcePath: '/tmp/app.toml',
      })

      const state1 = mod.validate()
      const state2 = mod.validate()
      expect(state1).toBe(state2)
    })
  })

  describe('identity', () => {
    test('uses fixed identity when uidIsClientProvided is false', () => {
      const mod = new AppModule({
        spec: specWithContract(undefined, {identifier: 'app_home', uidIsClientProvided: false}),
        config: {name: 'My App'},
        sourcePath: '/tmp/app.toml',
      })
      expect(mod.handle).toBe('app_home')
      expect(mod.uid).toBe('app_home')
    })

    test('uses config-derived identity when uidIsClientProvided is true', () => {
      const mod = new AppModule({
        spec: specWithContract(undefined, {identifier: 'function', uidIsClientProvided: true}),
        config: {handle: 'my-func', uid: 'custom-uid', name: 'My Function'},
        sourcePath: '/tmp/ext.toml',
      })
      expect(mod.handle).toBe('my-func')
      expect(mod.uid).toBe('custom-uid')
    })

    test('uses explicit identity override when provided', () => {
      const mod = new AppModule({
        spec: specWithContract(undefined, {identifier: 'webhook_subscription'}),
        config: {topic: 'products/create', uri: '/webhooks', filter: ''},
        sourcePath: '/tmp/app.toml',
        identity: contentHashIdentity(['topic', 'uri', 'filter']),
      })
      // Handle is a hash of the content fields
      expect(mod.handle).toBeTruthy()
      expect(mod.handle).not.toBe('webhook_subscription')
      // UID is the joined content fields
      expect(mod.uid).toBe('products/create::/webhooks::')
    })

    test('type is always the spec identifier', () => {
      const mod = new AppModule({
        spec: specWithContract(undefined, {identifier: 'branding'}),
        config: {},
        sourcePath: '/tmp/app.toml',
      })
      expect(mod.type).toBe('branding')
    })
  })
})
