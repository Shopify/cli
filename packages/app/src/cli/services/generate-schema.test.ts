import {generateSchemaService} from './generate-schema.js'
import {testAppLinked, testDeveloperPlatformClient, testFunctionExtension} from '../models/app/app.test-data.js'
import {describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile, mkdir} from '@shopify/cli-kit/node/fs'
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
      const orgId = 'test'
      const extensionDir = joinPath(tmpDir, 'extensions', 'my-function')
      await mkdir(extensionDir)

      const app = testAppLinked()
      const extension = await testFunctionExtension({
        dir: tmpDir,
      })

      // When
      await generateSchemaService({
        app,
        extension,
        path: tmpDir,
        stdout: false,
        developerPlatformClient: testDeveloperPlatformClient(),
        orgId,
      })

      // Then
      const outputFile = await readFile(joinPath(extension.directory, 'schema.graphql'))
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
      const orgId = '123'
      const mockOutput = vi.fn()
      vi.spyOn(output, 'outputResult').mockImplementation(mockOutput)

      // When
      await generateSchemaService({
        app,
        extension,
        path,
        stdout,
        developerPlatformClient: testDeveloperPlatformClient(),
        orgId,
      })

      // Then
      expect(mockOutput).toHaveBeenCalledWith('schema')
    })
  })

  describe('GraphQL query', () => {
    test('Uses ApiSchemaDefinitionQuery when not using targets', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extensions', 'my-function')
        await mkdir(extensionDir)

        const app = testAppLinked()
        const extension = await testFunctionExtension({
          dir: tmpDir,
          config: {
            name: 'test function extension',
            description: 'description',
            type: 'api_type',
            build: {
              command: 'echo "hello world"',
              wasm_opt: true,
            },
            api_version: 'unstable',
            configuration_ui: true,
            metafields: [],
          },
        })

        const orgId = 'test'
        const path = tmpDir
        const version = extension.configuration.api_version
        const developerPlatformClient = testDeveloperPlatformClient()

        await generateSchemaService({
          app,
          extension,
          path,
          stdout: false,
          developerPlatformClient,
          orgId,
        })

        expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith(
          {
            version,
            type: extension.configuration.type,
          },
          app.configuration.client_id,
          orgId,
        )
      })
    })

    test('Uses TargetSchemaDefinitionQuery when targets present', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extensions', 'my-function')
        await mkdir(extensionDir)

        const app = testAppLinked()
        const extension = await testFunctionExtension({
          dir: tmpDir,
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
              wasm_opt: true,
            },
            api_version: 'unstable',
            configuration_ui: true,
            metafields: [],
          },
        })

        const path = tmpDir
        const expectedTarget = extension.configuration.targeting![0]!.target
        const version = extension.configuration.api_version
        const orgId = 'test'
        const developerPlatformClient = testDeveloperPlatformClient()

        await generateSchemaService({
          app,
          extension,
          path,
          stdout: false,
          developerPlatformClient,
          orgId,
        })

        expect(developerPlatformClient.targetSchemaDefinition).toHaveBeenCalledWith(
          {
            handle: expectedTarget,
            version,
          },
          app.configuration.client_id,
          orgId,
        )
      })
    })
  })

  test('aborts if a schema could not be generated', async () => {
    // Given
    const app = testAppLinked()
    const extension = await testFunctionExtension()
    const orgId = '123'
    const developerPlatformClient = testDeveloperPlatformClient({
      apiSchemaDefinition: () => Promise.resolve(null),
    })

    // When
    const result = generateSchemaService({
      app,
      extension,
      path: '',
      stdout: true,
      developerPlatformClient,
      orgId,
    })

    // Then
    await expect(result).rejects.toThrow(AbortError)
  })
})
