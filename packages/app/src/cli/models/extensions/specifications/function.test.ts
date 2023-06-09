import {FunctionConfigType} from './function.js'
import {Identifiers} from '../../app/identifiers.js'
import {testFunctionExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import {inTemporaryDirectory, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {beforeEach, describe, expect, test} from 'vitest'

describe('functionConfiguration', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let identifiers: Identifiers
  let token: string

  beforeEach(async () => {
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
        configurationUi: false,
        apiVersion: '2022-07',
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
      const moduleId = 'module_id'
      const appKey = 'app-key'
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
        api_version: extension.configuration.apiVersion,
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const moduleId = 'module_id'
      const appKey = 'app-key'
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
        api_version: extension.configuration.apiVersion,
        module_id: moduleId,
        enable_creation_ui: true,
        input_query: undefined,
        input_query_variabels: undefined,
        ui: undefined,
      })
    })
  })
})
