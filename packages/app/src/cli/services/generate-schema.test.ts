import {generateSchemaService} from './generate-schema.js'
import {testAppLinked, testDeveloperPlatformClient, testFunctionExtension} from '../models/app/app.test-data.js'
import {ApiSchemaDefinitionQueryVariables} from '../api/graphql/functions/api_schema_definition.js'
import {describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as output from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('../../../models/app/loader.ts')
vi.mock('../models/app/identifiers.js', async () => {
  const identifiers: any = await vi.importActual('../models/app/identifiers.js')
  return {
    ...identifiers,
    getAppIdentifiers: vi.fn(),
  }
})
vi.mock('./context.js', async () => {
  const context: any = await vi.importActual('./context.js')
  return {
    ...context,
    fetchOrCreateOrganizationApp: vi.fn(),
  }
})

describe('generateSchemaService', () => {
  test('Save the latest GraphQL schema to ./[extension]/schema.graphql when stdout flag is ABSENT', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = testAppLinked()
      const extension = await testFunctionExtension({})
      const apiKey = 'api-key'
      const path = tmpDir

      // When
      await generateSchemaService({
        app,
        extension,
        path,
        stdout: false,
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      // Then
      const outputFile = await readFile(joinPath(tmpDir, 'schema.graphql'))
      expect(outputFile).toEqual('schema')
    })
  })

  test('Print the latest GraphQL schema to stdout when stdout flag is PRESENT', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = testAppLinked()
      const extension = await testFunctionExtension()
      const path = tmpDir
      const stdout = true
      const mockOutput = vi.fn()
      vi.spyOn(output, 'outputInfo').mockImplementation(mockOutput)

      // When
      await generateSchemaService({
        app,
        extension,
        path,
        stdout,
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      // Then
      expect(mockOutput).toHaveBeenCalledWith('schema')
    })
  })

  describe('GraphQL query', () => {
    test('Uses ApiSchemaDefinitionQuery when not using targets', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const app = testAppLinked()
        const extension = await testFunctionExtension({
          config: {
            name: 'test function extension',
            description: 'description',
            type: 'api_type',
            build: {
              command: 'echo "hello world"',
            },
            api_version: 'unstable',
            configuration_ui: true,
            metafields: [],
          },
        })
        const apiKey = 'api-key'
        const path = tmpDir
        const {
          configuration: {api_version: version},
          type,
        } = extension
        const developerPlatformClient = testDeveloperPlatformClient()

        // When
        await generateSchemaService({
          app,
          extension,
          path,
          stdout: false,
          developerPlatformClient,
        })

        // Then
        expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith({
          apiKey,
          version,
          type,
        })
      })
    })

    test('Uses TargetSchemaDefinitionQuery when targets present', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const app = testAppLinked()
        const extension = await testFunctionExtension({
          config: {
            name: 'test function extension',
            description: 'description',
            type: 'function',
            targeting: [
              {
                target: 'first',
              },
              {
                target: 'second',
              },
            ],
            build: {
              command: 'echo "hello world"',
            },
            api_version: 'unstable',
            configuration_ui: true,
            metafields: [],
          },
        })
        const apiKey = 'api-key'
        const path = tmpDir
        const expectedTarget = extension.configuration.targeting![0]!.target
        const version = extension.configuration.api_version
        const developerPlatformClient = testDeveloperPlatformClient()

        // When
        await generateSchemaService({
          app,
          extension,
          path,
          stdout: false,
          developerPlatformClient,
        })

        // Then
        expect(developerPlatformClient.targetSchemaDefinition).toHaveBeenCalledWith({
          apiKey,
          version,
          target: expectedTarget,
        })
      })
    })
  })

  test('aborts if a schema could not be generated', async () => {
    // Given
    const app = testAppLinked()
    const extension = await testFunctionExtension()
    const apiKey = 'api-key'
    const developerPlatformClient = testDeveloperPlatformClient({
      apiSchemaDefinition: (_input: ApiSchemaDefinitionQueryVariables) => Promise.resolve(null),
    })

    // When
    const result = generateSchemaService({
      app,
      extension,
      path: '',
      stdout: true,
      developerPlatformClient,
    })

    // Then
    await expect(result).rejects.toThrow(AbortError)
  })
})
