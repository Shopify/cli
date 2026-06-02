import {writeCachedSchemas} from './write-cached-schemas.js'
import {testAppLinked} from '../../models/app/app.test-data.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {RemoteAwareExtensionSpecification} from '../../models/extensions/specification.js'
import {inTemporaryDirectory, fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

async function readSchema(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path))
}

async function loadSpecsAsRemoteAware(): Promise<RemoteAwareExtensionSpecification[]> {
  const specs = await loadLocalExtensionsSpecifications()
  return specs.map((spec) => ({...spec, loadedRemoteSpecs: true})) as RemoteAwareExtensionSpecification[]
}

describe('writeCachedSchemas', () => {
  test('writes the app config schema to .shopify/schemas/app.schema.json', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specs = await loadSpecsAsRemoteAware()
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      const index = await writeCachedSchemas(app)

      // Then
      const expectedPath = joinPath(tmp, '.shopify/schemas/app.schema.json')
      expect(index.appSchemaPath).toBe(expectedPath)
      await expect(fileExists(expectedPath)).resolves.toBe(true)

      const schema = await readSchema(expectedPath)
      expect(schema).toMatchObject({
        type: 'object',
        properties: expect.objectContaining({
          client_id: expect.anything(),
          name: expect.anything(),
        }),
      })
    })
  })

  test('merges remote validationSchema contracts from app-config specs into the app schema root', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given — an app-config spec (uidStrategy: single) carries a remote contract that
      // declares a key the local Zod side doesn't know about.
      const specs = await loadSpecsAsRemoteAware()
      const appConfigSpec = specs.find((spec) => spec.uidStrategy === 'single')!
      const remoteOnlyKey = `remote_only_key_${Date.now()}`
      appConfigSpec.validationSchema = {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {
            [remoteOnlyKey]: {type: 'object', properties: {flag: {type: 'boolean'}}},
          },
        }),
      }
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      await writeCachedSchemas(app)

      // Then — the server-only key surfaces as a root property of the app schema.
      const schema = await readSchema(joinPath(tmp, '.shopify/schemas/app.schema.json'))
      const properties = schema.properties as Record<string, unknown>
      expect(properties[remoteOnlyKey]).toEqual({
        type: 'object',
        properties: {flag: {type: 'boolean'}},
      })
    })
  })

  test('keeps the top-level `extensions` array permissive so dynamic entries do not fail validation', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specs = await loadSpecsAsRemoteAware()
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      await writeCachedSchemas(app)

      // Then
      const schema = await readSchema(joinPath(tmp, '.shopify/schemas/app.schema.json'))
      expect(schema.properties).toMatchObject({
        extensions: {
          type: 'array',
          items: {type: 'object', additionalProperties: true},
        },
      })
    })
  })

  test('writes a per-extension schema for every non-single-uid spec', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specs = await loadSpecsAsRemoteAware()
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      const index = await writeCachedSchemas(app)

      // Then
      const perExtension = specs.filter((spec) => spec.uidStrategy !== 'single')
      expect(index.extensionSchemaByIdentifier.size).toBe(perExtension.length)
      for (const spec of perExtension) {
        const expectedPath = joinPath(tmp, `.shopify/schemas/extensions/${spec.identifier}.schema.json`)
        expect(index.extensionSchemaByIdentifier.get(spec.identifier)).toBe(expectedPath)
        // eslint-disable-next-line no-await-in-loop
        await expect(fileExists(expectedPath)).resolves.toBe(true)
      }
    })
  })

  test('skips specs that contribute to the app config (uidStrategy single)', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specs = await loadSpecsAsRemoteAware()
      const singleSpec = specs.find((spec) => spec.uidStrategy === 'single')
      expect(singleSpec, 'fixture sanity check: expected at least one single-uid spec').toBeDefined()
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      const index = await writeCachedSchemas(app)

      // Then
      expect(index.extensionSchemaByIdentifier.has(singleSpec!.identifier)).toBe(false)
      const expectedPath = joinPath(tmp, `.shopify/schemas/extensions/${singleSpec!.identifier}.schema.json`)
      await expect(fileExists(expectedPath)).resolves.toBe(false)
    })
  })

  test('emits an anyOf accepting both legacy flat TOMLs and modern [[extensions]] array TOMLs, sharing one definitions entry', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specs = await loadSpecsAsRemoteAware()
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      await writeCachedSchemas(app)

      // Then
      const sampleSpec = specs.find((spec) => spec.uidStrategy !== 'single')!
      const schema = await readSchema(joinPath(tmp, `.shopify/schemas/extensions/${sampleSpec.identifier}.schema.json`))

      // Entry shape lives at definitions/entry and carries the base property keys plus the spec's own.
      const entry = (schema.definitions as Record<string, unknown>).entry as Record<string, unknown>
      const entryProps = entry.properties as Record<string, unknown>
      for (const key of ['type', 'handle', 'uid', 'path']) {
        expect(entryProps).toHaveProperty(key)
      }

      // anyOf has two branches: a bare $ref for the legacy flat shape and a wrapped object for
      // the modern `api_version` + `[[extensions]]` shape.
      const branches = schema.anyOf as Record<string, unknown>[]
      expect(branches).toHaveLength(2)
      expect(branches[0]).toEqual({$ref: '#/definitions/entry'})

      const modern = branches[1]!
      const modernProps = modern.properties as Record<string, unknown>
      expect(modernProps.api_version).toEqual({type: 'string'})
      const extensions = modernProps.extensions as Record<string, unknown>
      expect(extensions.type).toBe('array')
      expect(extensions.items).toEqual({$ref: '#/definitions/entry'})
    })
  })

  test('rewrites internal $refs that survive dereferencing (e.g. circular) to point under definitions/entry', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given — a circular schema. `normaliseJsonSchema` calls $RefParser.dereference() which
      // intentionally leaves circular refs in place. Without rewriting they'd dangle when the
      // entry is moved under definitions/entry.
      const specs = await loadSpecsAsRemoteAware()
      const targetSpec = specs.find((spec) => spec.uidStrategy !== 'single')!
      targetSpec.validationSchema = {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {
            node: {
              type: 'object',
              properties: {
                children: {
                  type: 'array',
                  items: {$ref: '#/properties/node'},
                },
              },
            },
          },
        }),
      }
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      await writeCachedSchemas(app)

      // Then — the surviving ref now lives under definitions/entry, not at the wrapper root.
      const schema = await readSchema(joinPath(tmp, `.shopify/schemas/extensions/${targetSpec.identifier}.schema.json`))
      const refs: string[] = []
      const walk = (value: unknown): void => {
        if (value === null || typeof value !== 'object') return
        if (Array.isArray(value)) {
          value.forEach(walk)
          return
        }
        const obj = value as Record<string, unknown>
        if (typeof obj.$ref === 'string') refs.push(obj.$ref)
        for (const key of Object.keys(obj)) walk(obj[key])
      }
      walk(schema)
      for (const ref of refs) {
        expect(ref.startsWith('#/properties/')).toBe(false)
      }
      expect(refs).toContain('#/definitions/entry/properties/node')
    })
  })

  test('strips api_version from definitions/entry required/properties (it lives at the file root in modern TOMLs)', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given — a spec where api_version is required inside the entry contract.
      const specs = await loadSpecsAsRemoteAware()
      const targetSpec = specs.find((spec) => spec.uidStrategy !== 'single')!
      targetSpec.validationSchema = {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {
            api_version: {type: 'string'},
            name: {type: 'string'},
            type: {type: 'string'},
          },
          required: ['name', 'type', 'api_version'],
        }),
      }
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      await writeCachedSchemas(app)

      // Then — the shared entry shape should not require or carry api_version.
      const schema = await readSchema(joinPath(tmp, `.shopify/schemas/extensions/${targetSpec.identifier}.schema.json`))
      const entry = (schema.definitions as Record<string, unknown>).entry as Record<string, unknown>
      expect(entry.required as string[]).not.toContain('api_version')
      expect((entry.properties as Record<string, unknown>).api_version).toBeUndefined()
    })
  })

  test('prefers a remote validationSchema over Zod conversion when both are available', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specs = await loadSpecsAsRemoteAware()
      const targetSpec = specs.find((spec) => spec.uidStrategy !== 'single')!
      const remoteOnlyMarker = `remote-only-property-${Date.now()}`
      targetSpec.validationSchema = {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {
            [remoteOnlyMarker]: {type: 'string'},
          },
        }),
      }
      const app = testAppLinked({directory: tmp, specifications: specs})

      // When
      await writeCachedSchemas(app)

      // Then — the remote marker should appear in the shared definitions/entry shape.
      const schema = await readSchema(joinPath(tmp, `.shopify/schemas/extensions/${targetSpec.identifier}.schema.json`))
      const entry = (schema.definitions as Record<string, unknown>).entry as Record<string, unknown>
      expect((entry.properties as Record<string, unknown>)[remoteOnlyMarker]).toEqual({type: 'string'})
    })
  })
})
