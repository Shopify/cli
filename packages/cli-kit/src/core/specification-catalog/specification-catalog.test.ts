import {SpecificationCatalog, RemoteSpecInput} from './specification-catalog.js'
import {zod} from '../../public/node/schema.js'
import {describe, expect, test} from 'vitest'

function remoteSpec(overrides: Partial<RemoteSpecInput> = {}): RemoteSpecInput {
  return {
    identifier: 'test_spec',
    name: 'Test Spec',
    externalIdentifier: 'test_spec_external',
    experience: 'extension',
    options: {
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
    ...overrides,
  }
}

const SIMPLE_JSON_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    name: {type: 'string'},
  },
  required: ['name'],
})

describe('SpecificationCatalog', () => {
  describe('build', () => {
    test('creates specs from remote specs', async () => {
      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [
          remoteSpec({identifier: 'app_home', name: 'App Home'}),
          remoteSpec({identifier: 'branding', name: 'Branding'}),
        ],
      })

      expect(catalog.all()).toHaveLength(2)
      expect(catalog.get('app_home')?.name).toBe('App Home')
      expect(catalog.get('branding')?.name).toBe('Branding')
    })

    test('filters out deprecated specs', async () => {
      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [
          remoteSpec({identifier: 'active', experience: 'extension'}),
          remoteSpec({identifier: 'old', experience: 'deprecated'}),
        ],
      })

      expect(catalog.all()).toHaveLength(1)
      expect(catalog.get('active')).toBeDefined()
      expect(catalog.get('old')).toBeUndefined()
    })

    test('builds server contract from validationSchema', async () => {
      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [
          remoteSpec({
            identifier: 'channel_config',
            validationSchema: {jsonSchema: SIMPLE_JSON_SCHEMA},
          }),
        ],
      })

      const spec = catalog.get('channel_config')!
      expect(spec.contract).toBeDefined()
      expect(spec.contract!.validate({name: 'hello'})).toHaveLength(0)
      expect(spec.contract!.validate({}).length).toBeGreaterThan(0)
    })

    test('builds adapter contract from local schema only (no transform)', async () => {
      const localSchema = zod.object({application_url: zod.string().url()})

      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [remoteSpec({identifier: 'app_home'})],
        localSchemas: {app_home: localSchema},
      })

      const spec = catalog.get('app_home')!
      expect(spec.contract).toBeDefined()
      expect(spec.contract!.validate({application_url: 'https://example.com'})).toHaveLength(0)
      expect(spec.contract!.validate({application_url: 'not-a-url'}).length).toBeGreaterThan(0)
    })

    test('builds adapter contract from local schema + sync transform', async () => {
      const serverSchema = zod.object({app_url: zod.string().url()})
      const transform = (config: Record<string, unknown>) => ({
        app_url: config.application_url as string,
      })

      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [remoteSpec({identifier: 'app_home'})],
        localSchemas: {app_home: serverSchema},
        syncTransforms: {app_home: transform},
      })

      const spec = catalog.get('app_home')!
      expect(spec.contract).toBeDefined()
      // Validates file-shape input by transforming internally
      expect(spec.contract!.validate({application_url: 'https://example.com'})).toHaveLength(0)
      expect(spec.contract!.validate({application_url: 'not-a-url'}).length).toBeGreaterThan(0)
    })

    test('composes server contract with adapter contract when both exist', async () => {
      const localSchema = zod.object({name: zod.string().min(3)})

      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [
          remoteSpec({
            identifier: 'branding',
            validationSchema: {jsonSchema: SIMPLE_JSON_SCHEMA},
          }),
        ],
        localSchemas: {branding: localSchema},
      })

      const spec = catalog.get('branding')!
      // 'hi' passes JSON Schema (it's a string) but fails Zod (min 3)
      const errors = spec.contract!.validate({name: 'hi'})
      expect(errors.length).toBeGreaterThan(0)
    })

    test('includes local-only specs not in remote', async () => {
      const localSchema = zod.object({enabled: zod.boolean()})

      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [remoteSpec({identifier: 'remote_spec'})],
        localSchemas: {gated_spec: localSchema},
        localOnlyIdentifiers: ['gated_spec'],
      })

      expect(catalog.all()).toHaveLength(2)
      expect(catalog.get('gated_spec')).toBeDefined()
      expect(catalog.get('gated_spec')!.contract).toBeDefined()
    })

    test('does not duplicate specs in both remote and localOnlyIdentifiers', async () => {
      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [remoteSpec({identifier: 'app_home'})],
        localOnlyIdentifiers: ['app_home'],
      })

      expect(catalog.all()).toHaveLength(1)
    })

    test('maps remote fields correctly', async () => {
      const catalog = await SpecificationCatalog.build({
        remoteSpecs: [
          remoteSpec({
            identifier: 'function',
            name: 'Function',
            externalIdentifier: 'function_external',
            options: {registrationLimit: 50, uidIsClientProvided: true},
          }),
        ],
      })

      const spec = catalog.get('function')!
      expect(spec.identifier).toBe('function')
      expect(spec.name).toBe('Function')
      expect(spec.externalIdentifier).toBe('function_external')
      expect(spec.appModuleLimit).toBe(50)
      expect(spec.uidIsClientProvided).toBe(true)
    })
  })

  describe('lookup', () => {
    test('get returns undefined for unknown identifier', async () => {
      const catalog = await SpecificationCatalog.build({remoteSpecs: []})
      expect(catalog.get('nonexistent')).toBeUndefined()
    })

    test('all returns empty array when no specs', async () => {
      const catalog = await SpecificationCatalog.build({remoteSpecs: []})
      expect(catalog.all()).toHaveLength(0)
    })
  })
})
