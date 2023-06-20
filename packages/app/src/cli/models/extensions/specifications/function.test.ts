import {FunctionConfigType} from './function.js'
import {testFunctionExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import {inTemporaryDirectory, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test} from 'vitest'

describe('functionConfiguration', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let moduleId: string
  let appKey: string

  beforeEach(async () => {
    moduleId = 'module_id'
    appKey = 'app-key'
    extension = await testFunctionExtension({
      dir: '/function',
      config: {
        name: 'function',
        type: 'order_discounts',
        metafields: [],
        description: 'my function',
        build: {
          command: 'make build',
          path: 'dist/index.wasm',
        },
        ui: {
          paths: {
            create: '/create',
            details: '/details/:id',
          },
          enable_create: true,
        },
        configuration_ui: false,
        api_version: '2022-07',
        input: {
          variables: {
            namespace: 'namespace',
            key: 'key',
          },
        },
      },
    })
  })

  test('returns a snake_case object with all possible fields', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputQuery = 'inputQuery'
      extension.directory = tmpDir
      await touchFile(extension.inputQueryPath)
      await writeFile(extension.inputQueryPath, inputQuery)

      // When
      const got = await extension.deployConfig(appKey, moduleId)

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: appKey,
        api_type: 'order_discounts',
        api_version: extension.configuration.api_version,
        ui: {
          app_bridge: {
            details_path: extension.configuration.ui!.paths!.details,
            create_path: extension.configuration.ui!.paths!.create,
          },
        },
        input_query: inputQuery,
        input_query_variables: {
          single_json_metafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enable_creation_ui: true,
        module_id: moduleId,
      })
    })
  })

  test('returns a snake_case object with only required fields', async () => {
    await inTemporaryDirectory(async (_tmpDir) => {
      // Given
      extension.configuration.input = undefined
      extension.configuration.ui = undefined

      // When
      const got = await extension.deployConfig(appKey, moduleId)

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: appKey,
        api_type: 'order_discounts',
        api_version: extension.configuration.api_version,
        module_id: moduleId,
        enable_creation_ui: true,
        input_query: undefined,
        input_query_variabels: undefined,
        ui: undefined,
      })
    })
  })

  test('parses targeting array', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.directory = tmpDir
      const inputQuery = 'query { f }'
      const inputQueryFileName = 'target1.graphql'
      extension.configuration.targeting = [
        {target: 'some.api.target1', input_query: inputQueryFileName},
        {target: 'some.api.target2', export: 'run_target2'},
      ]
      await writeFile(joinPath(extension.directory, inputQueryFileName), inputQuery)

      // When
      const got = await extension.deployConfig(appKey, moduleId)

      // Then
      expect(got!.targets).toEqual([
        {handle: 'some.api.target1', input_query: inputQuery},
        {handle: 'some.api.target2', export: 'run_target2'},
      ])
    })
  })

  test('aborts when an target input query file is missing', async () => {
    // Given
    extension.configuration.targeting = [{target: 'some.api.target1', input_query: 'this-is-not-a-file.graphql'}]

    // When & Then
    await expect(() => extension.deployConfig(appKey, moduleId)).rejects.toThrowError(AbortError)
  })
})
