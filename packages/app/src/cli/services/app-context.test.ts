import {linkedAppContext, refreshSchemaBank} from './app-context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {addUidToTomlsIfNecessary} from './app/add-uid-to-extension-toml.js'
import link from './app/config/link.js'
import {appFromIdentifiers} from './context.js'

import * as localStorage from './local-storage.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {testOrganizationApp, testDeveloperPlatformClient, testOrganization} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import * as loader from '../models/app/loader.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile, readFile, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {tryParseInt} from '@shopify/cli-kit/common/string'

vi.mock('../models/app/validation/multi-cli-warning.js')
vi.mock('./generate/fetch-extension-specifications.js')
vi.mock('./app/config/link.js')
vi.mock('./context.js')
vi.mock('./dev/fetch.js')
vi.mock('./app/add-uid-to-extension-toml.js')

async function writeAppConfig(tmp: string, content: string, configName?: string) {
  const appConfigPath = joinPath(tmp, configName ?? 'shopify.app.toml')
  const packageJsonPath = joinPath(tmp, 'package.json')
  await writeFile(appConfigPath, content)
  await writeFile(packageJsonPath, '{}')
}

const mockDeveloperPlatformClient = testDeveloperPlatformClient()
const mockOrganization = testOrganization()
const mockRemoteApp = testOrganizationApp({
  apiKey: 'test-api-key',
  title: 'Test App',
  organizationId: 'test-org-id',
  developerPlatformClient: mockDeveloperPlatformClient,
})

beforeEach(() => {
  vi.mocked(fetchSpecifications).mockResolvedValue([])
  vi.mocked(appFromIdentifiers).mockResolvedValue(mockRemoteApp)
  vi.mocked(fetchOrgFromId).mockResolvedValue(mockOrganization)
})

describe('linkedAppContext', () => {
  test('returns linked app context when app is already linked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      // When
      const result = await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(result).toEqual({
        app: expect.objectContaining({
          configuration: {
            client_id: 'test-api-key',
            path: joinPath(tmp, 'shopify.app.toml'),
          },
        }),
        remoteApp: mockRemoteApp,
        developerPlatformClient: expect.any(Object),
        specifications: [],
        organization: mockOrganization,
      })
      expect(link).not.toHaveBeenCalled()
    })
  })

  test('links app when it is not linked, and config file is cached', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const content = ''
      await writeAppConfig(tmp, content, 'shopify.app.stg.toml')
      localStorage.setCachedAppInfo({
        appId: 'test-api-key',
        title: 'Test App',
        directory: tmp,
        orgId: 'test-org-id',
        configFile: 'shopify.app.stg.toml',
      })

      // Given
      vi.mocked(link).mockResolvedValue({
        remoteApp: mockRemoteApp,
        state: {
          state: 'connected-app',
          appDirectory: tmp,
          configurationPath: `${tmp}/shopify.app.stg.toml`,
          configSource: 'cached',
          configurationFileName: 'shopify.app.stg.toml',
          basicConfiguration: {client_id: 'test-api-key', path: joinPath(tmp, 'shopify.app.stg.toml')},
        },
        configuration: {
          client_id: 'test-api-key',
          name: 'test-app',
          application_url: 'https://test-app.com',
          path: joinPath(tmp, 'shopify.app.stg.toml'),
          embedded: false,
        },
      })

      // When
      const result = await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(result).toEqual({
        app: expect.any(Object),
        remoteApp: mockRemoteApp,
        developerPlatformClient: expect.any(Object),
        specifications: [],
        organization: mockOrganization,
      })
      expect(link).toHaveBeenCalledWith({directory: tmp, apiKey: undefined, configName: 'shopify.app.stg.toml'})
    })
  })

  test('updates cached app info when remoteApp matches', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(appFromIdentifiers).mockResolvedValue({...mockRemoteApp, apiKey: 'test-api-key-new'})
      const content = `client_id="test-api-key-new"`
      await writeAppConfig(tmp, content)
      localStorage.setCachedAppInfo({
        appId: 'test-api-key-old',
        title: 'Test App',
        directory: tmp,
        orgId: 'test-org-id',
      })

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })
      const result = localStorage.getCachedAppInfo(tmp)

      // Then
      expect(link).not.toHaveBeenCalled()

      expect(result).toEqual({
        appId: 'test-api-key-new',
        title: 'Test App',
        directory: expect.any(String),
        orgId: 'test-org-id',
      })
    })
  })

  test('uses provided clientId when available and updates the app configuration', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const newClientId = 'new-api-key'

      vi.mocked(appFromIdentifiers).mockResolvedValue({...mockRemoteApp, apiKey: newClientId})

      // When
      const result = await linkedAppContext({
        directory: tmp,
        clientId: newClientId,
        forceRelink: false,
        userProvidedConfigName: undefined,
      })

      // Then
      expect(link).not.toHaveBeenCalled()
      expect(result.remoteApp.apiKey).toBe(newClientId)
      expect(result.app.configuration.client_id).toEqual('new-api-key')
      expect(appFromIdentifiers).toHaveBeenCalledWith(expect.objectContaining({apiKey: newClientId}))
    })
  })

  test('resets app when there is a valid toml but reset option is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      vi.mocked(link).mockResolvedValue({
        remoteApp: mockRemoteApp,
        state: {
          state: 'connected-app',
          appDirectory: tmp,
          configurationPath: `${tmp}/shopify.app.toml`,
          configSource: 'cached',
          configurationFileName: 'shopify.app.toml',
          basicConfiguration: {client_id: 'test-api-key', path: joinPath(tmp, 'shopify.app.toml')},
        },
        configuration: {
          client_id: 'test-api-key',
          name: 'test-app',
          application_url: 'https://test-app.com',
          path: joinPath(tmp, 'shopify.app.toml'),
          embedded: false,
        },
      })

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: true,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(link).toHaveBeenCalledWith({directory: tmp, apiKey: undefined, configName: 'shopify.app.toml'})
    })
  })

  test('logs metadata', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      const meta = metadata.getAllPublicMetadata()
      expect(meta).toEqual(
        expect.objectContaining({
          business_platform_id: tryParseInt(mockOrganization.id),
          api_key: mockRemoteApp.apiKey,
          cmd_app_reset_used: false,
        }),
      )
      expect(meta).not.toHaveProperty('partner_id')
    })
  })

  test('uses unsafeReportMode when provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadAppUsingConfigurationState')

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
        unsafeReportMode: true,
      })

      // Then
      expect(vi.mocked(addUidToTomlsIfNecessary)).not.toHaveBeenCalled()
      expect(loadSpy).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({mode: 'report'}))
      loadSpy.mockRestore()
    })
  })

  test('does not use unsafeReportMode when not provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadAppUsingConfigurationState')

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(vi.mocked(addUidToTomlsIfNecessary)).toHaveBeenCalled()
      expect(loadSpy).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({mode: 'strict'}))
      loadSpy.mockRestore()
    })
  })
})

describe('refreshSchemaBank', () => {
  test('creates .shopify/schemas directory if it does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'test-extension',
          validationSchema: {
            jsonSchema: '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}',
          },
          loadedRemoteSpecs: true,
        },
      ]
      const shopifyDir = joinPath(tmp, '.shopify')
      const schemasDir = joinPath(shopifyDir, 'schemas')

      // When
      await refreshSchemaBank(specifications as any, tmp)

      // Then
      await expect(fileExists(shopifyDir)).resolves.toBe(true)
      await expect(fileExists(schemasDir)).resolves.toBe(true)
    })
  })

  test('writes JSON schemas to the .shopify/schemas directory', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const schema1Content = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          foo: {
            type: 'string',
          },
        },
      }
      const schema2Content = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          bar: {
            type: 'number',
          },
        },
      }

      const schema1 = JSON.stringify(schema1Content)
      const schema2 = JSON.stringify(schema2Content)

      const specifications = [
        {
          identifier: 'extension1',
          validationSchema: {
            jsonSchema: schema1,
          },
          loadedRemoteSpecs: true,
        },
        {
          identifier: 'extension2',
          validationSchema: {
            jsonSchema: schema2,
          },
          loadedRemoteSpecs: true,
        },
      ]

      // When
      await refreshSchemaBank(specifications as any, tmp)

      // Then
      const extension1SchemaPath = joinPath(tmp, '.shopify', 'schemas', 'extension1.schema.json')
      const extension2SchemaPath = joinPath(tmp, '.shopify', 'schemas', 'extension2.schema.json')

      await expect(fileExists(extension1SchemaPath)).resolves.toBe(true)
      await expect(fileExists(extension2SchemaPath)).resolves.toBe(true)

      const extension1Schema = await readFile(extension1SchemaPath)
      const extension2Schema = await readFile(extension2SchemaPath)

      // Verify that the schemas are properly pretty-printed
      expect(JSON.parse(extension1Schema)).toEqual(schema1Content)
      expect(JSON.parse(extension2Schema)).toEqual(schema2Content)

      // Verify the formatting
      expect(extension1Schema).toContain('{\n  "$schema"')
      expect(extension2Schema).toContain('{\n  "$schema"')
    })
  })

  test('handles specifications without validation schemas', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'extension-with-schema',
          validationSchema: {
            jsonSchema: '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}',
          },
          loadedRemoteSpecs: true,
        },
        {
          identifier: 'extension-without-schema',
          loadedRemoteSpecs: true,
        },
        {
          identifier: 'extension-with-empty-schema',
          validationSchema: null,
          loadedRemoteSpecs: true,
        },
      ]

      // When
      await refreshSchemaBank(specifications as any, tmp)

      // Then
      const withSchemaPath = joinPath(tmp, '.shopify', 'schemas', 'extension-with-schema.schema.json')
      const withoutSchemaPath = joinPath(tmp, '.shopify', 'schemas', 'extension-without-schema.schema.json')
      const withEmptySchemaPath = joinPath(tmp, '.shopify', 'schemas', 'extension-with-empty-schema.schema.json')

      await expect(fileExists(withSchemaPath)).resolves.toBe(true)
      await expect(fileExists(withoutSchemaPath)).resolves.toBe(false)
      await expect(fileExists(withEmptySchemaPath)).resolves.toBe(false)
    })
  })

  test('cleans up old schema files that are no longer in the specifications', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const schemasDir = joinPath(tmp, '.shopify', 'schemas')
      await mkdir(schemasDir)

      // Create some initial schema files
      const oldSchema1 = '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}'
      const oldSchema2 = '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}'
      const oldSchema3 = '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}'

      await writeFile(joinPath(schemasDir, 'old-extension1.schema.json'), oldSchema1)
      await writeFile(joinPath(schemasDir, 'old-extension2.schema.json'), oldSchema2)
      await writeFile(joinPath(schemasDir, 'keep-extension.schema.json'), oldSchema3)

      // Create some non-schema files that should be preserved
      await writeFile(joinPath(schemasDir, 'not-a-schema.json'), '{}')
      await writeFile(joinPath(schemasDir, 'something-else.txt'), 'text file')

      // New specifications only include one of the existing schemas
      const specifications = [
        {
          identifier: 'keep-extension',
          validationSchema: {
            jsonSchema: oldSchema3,
          },
          loadedRemoteSpecs: true,
        },
        {
          identifier: 'new-extension',
          validationSchema: {
            jsonSchema: '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}',
          },
          loadedRemoteSpecs: true,
        },
      ]

      // When
      await refreshSchemaBank(specifications as any, tmp)

      // Then
      // Old schema files should be removed
      await expect(fileExists(joinPath(schemasDir, 'old-extension1.schema.json'))).resolves.toBe(false)
      await expect(fileExists(joinPath(schemasDir, 'old-extension2.schema.json'))).resolves.toBe(false)

      // Kept and new schema files should exist
      await expect(fileExists(joinPath(schemasDir, 'keep-extension.schema.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(schemasDir, 'new-extension.schema.json'))).resolves.toBe(true)

      // Non-schema files should be preserved
      await expect(fileExists(joinPath(schemasDir, 'not-a-schema.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(schemasDir, 'something-else.txt'))).resolves.toBe(true)
    })
  })

  test('writes validation schemas to the schema bank', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'test-spec',
          validationSchema: {
            jsonSchema: JSON.stringify({
              type: 'object',
              properties: {
                test: {type: 'string'},
              },
            }),
          },
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      const schemaPath = joinPath(tmp, '.shopify', 'schemas', 'test-spec.schema.json')
      await expect(fileExists(schemaPath)).resolves.toBe(true)
      const schema = await readFile(schemaPath)
      expect(JSON.parse(schema)).toEqual({
        type: 'object',
        properties: {
          test: {type: 'string'},
        },
      })
    })
  })

  test('writes hardcoded schemas to the schema bank', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'hardcoded-spec',
          hardcodedInputJsonSchema: JSON.stringify({
            type: 'object',
            properties: {
              hardcoded: {type: 'string'},
            },
          }),
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      const schemaPath = joinPath(tmp, '.shopify', 'schemas', 'hardcoded-spec.schema.json')
      await expect(fileExists(schemaPath)).resolves.toBe(true)
      const schema = await readFile(schemaPath)
      expect(JSON.parse(schema)).toEqual({
        type: 'object',
        properties: {
          hardcoded: {type: 'string'},
        },
      })
    })
  })

  test('prioritizes hardcoded schemas over validation schemas', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'both-schemas',
          hardcodedInputJsonSchema: JSON.stringify({
            type: 'object',
            properties: {
              hardcoded: {type: 'string'},
            },
          }),
          validationSchema: {
            jsonSchema: JSON.stringify({
              type: 'object',
              properties: {
                validation: {type: 'string'},
              },
            }),
          },
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      const schemaPath = joinPath(tmp, '.shopify', 'schemas', 'both-schemas.schema.json')
      await expect(fileExists(schemaPath)).resolves.toBe(true)
      const schema = await readFile(schemaPath)
      expect(JSON.parse(schema)).toEqual({
        type: 'object',
        properties: {
          hardcoded: {type: 'string'},
        },
      })
    })
  })

  test('creates a combined config schema from config modules', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'config-module-1',
          uidStrategy: 'none',
          hardcodedInputJsonSchema: JSON.stringify({
            type: 'object',
            properties: {
              config1: {type: 'string'},
            },
            required: ['config1'],
          }),
        },
        {
          identifier: 'config-module-2',
          uidStrategy: 'none',
          validationSchema: {
            jsonSchema: JSON.stringify({
              type: 'object',
              properties: {
                config2: {type: 'boolean'},
              },
              required: ['config2'],
            }),
          },
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      const combinedSchemaPath = joinPath(tmp, '.shopify', 'schemas', 'app.schema.json')
      await expect(fileExists(combinedSchemaPath)).resolves.toBe(true)
      const schema = await readFile(combinedSchemaPath)
      const parsedSchema = JSON.parse(schema)

      expect(parsedSchema.properties).toMatchObject({
        client_id: {type: 'string'},
        organization_id: {type: 'string'},
        build: {type: 'object', additionalProperties: true},
        config1: {type: 'string'},
        config2: {type: 'boolean'},
      })

      expect(parsedSchema.required).toEqual(expect.arrayContaining(['client_id', 'config1', 'config2']))
    })
  })

  test('cleans up old schema files', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const schemasDir = joinPath(tmp, '.shopify', 'schemas')
      await mkdir(schemasDir)

      // Create some old schema files
      await writeFile(joinPath(schemasDir, 'old-spec.schema.json'), '{}')
      await writeFile(joinPath(schemasDir, 'current-spec.schema.json'), '{}')

      const specifications = [
        {
          identifier: 'current-spec',
          validationSchema: {
            jsonSchema: JSON.stringify({
              type: 'object',
              properties: {
                test: {type: 'string'},
              },
            }),
          },
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      await expect(fileExists(joinPath(schemasDir, 'old-spec.schema.json'))).resolves.toBe(false)
      await expect(fileExists(joinPath(schemasDir, 'current-spec.schema.json'))).resolves.toBe(true)
    })
  })

  test('writes validation schemas as pretty-printed JSON', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'test-spec',
          validationSchema: {
            jsonSchema: JSON.stringify({
              type: 'object',
              properties: {
                test: {type: 'string'},
                nested: {
                  type: 'object',
                  properties: {
                    prop1: {type: 'string'},
                    prop2: {type: 'number'},
                  },
                },
              },
            }),
          },
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      const schemaPath = joinPath(tmp, '.shopify', 'schemas', 'test-spec.schema.json')
      await expect(fileExists(schemaPath)).resolves.toBe(true)
      const schema = await readFile(schemaPath)

      // Verify schema is properly formatted with indentation
      expect(schema).toContain('{\n  "type": "object",')
      expect(schema).toContain('    "nested": {')
      expect(schema).toMatch(/[\s]{6}"type": "object"/)
    })
  })

  test('writes hardcoded schemas as pretty-printed JSON', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const specifications = [
        {
          identifier: 'hardcoded-spec',
          hardcodedInputJsonSchema: JSON.stringify({
            type: 'object',
            properties: {
              hardcoded: {type: 'string'},
              complex: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {type: 'string'},
                    value: {type: 'number'},
                  },
                },
              },
            },
          }),
        },
      ] as any

      // When
      await refreshSchemaBank(specifications, tmp)

      // Then
      const schemaPath = joinPath(tmp, '.shopify', 'schemas', 'hardcoded-spec.schema.json')
      await expect(fileExists(schemaPath)).resolves.toBe(true)
      const schema = await readFile(schemaPath)

      // Verify schema is properly formatted with indentation
      expect(schema).toContain('{\n  "type": "object",')
      expect(schema).toContain('    "complex": {')
      expect(schema).toMatch(/[\s]{6}"type": "array"/)
    })
  })
})
