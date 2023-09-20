import {FunctionConfigType} from './function.js'
import {testFunctionExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import * as upload from '../../../services/deploy/upload.js'
import {inTemporaryDirectory, touchFile, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/deploy/upload.js')

describe('functionConfiguration', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let moduleId: string
  let apiKey: string
  let token: string
  let unifiedDeployment: boolean

  beforeEach(async () => {
    moduleId = 'module_id'
    apiKey = 'app-key'
    token = 'app-token'
    unifiedDeployment = true

    vi.spyOn(upload, 'uploadWasmBlob').mockResolvedValue({
      url: 'http://foo.bar',
      moduleId,
    })

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
      const got = await extension.deployConfig({apiKey, token, unifiedDeployment})

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: apiKey,
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
        localization: {},
        targets: undefined,
      })
    })
  })

  test('returns a snake_case object with only required fields', async () => {
    await inTemporaryDirectory(async (_tmpDir) => {
      // Given
      extension.configuration.input = undefined
      extension.configuration.ui = undefined

      // When
      const got = await extension.deployConfig({apiKey, token, unifiedDeployment})

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: apiKey,
        api_type: 'order_discounts',
        api_version: extension.configuration.api_version,
        module_id: moduleId,
        enable_creation_ui: true,
        input_query: undefined,
        input_query_variables: undefined,
        ui: undefined,
        localization: {},
        targets: undefined,
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
      const got = await extension.deployConfig({apiKey, token, unifiedDeployment})

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
    await expect(() => extension.deployConfig({apiKey, token, unifiedDeployment})).rejects.toThrowError(AbortError)
  })

  test('parses locales', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.directory = tmpDir
      const enLocale = {
        extension: {
          title: 'English Title',
          description: 'English Description',
        },
      }

      const localesDir = joinPath(extension.directory, 'locales')
      await mkdir(localesDir)
      await writeFile(joinPath(localesDir, 'en.default.json'), JSON.stringify(enLocale))

      // When
      const got = await extension.deployConfig({apiKey, token, unifiedDeployment})

      // Then
      const expectedLocalization = {
        default_locale: 'en',
        translations: {
          en: 'eyJleHRlbnNpb24iOnsidGl0bGUiOiJFbmdsaXNoIFRpdGxlIiwiZGVzY3JpcHRpb24iOiJFbmdsaXNoIERlc2NyaXB0aW9uIn19',
        },
      }

      expect(got!.localization).toEqual(expectedLocalization)
    })
  })
})
