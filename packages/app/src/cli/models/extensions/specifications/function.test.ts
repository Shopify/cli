import {FunctionConfigType} from './function.js'
import {testFunctionExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import * as upload from '../../../services/deploy/upload.js'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {getPathValue} from '@shopify/cli-kit/common/object'

vi.mock('../../../services/deploy/upload.js')

describe('functionConfiguration', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  const moduleId = 'module_id'
  const apiKey = 'app-key'
  const token = 'app-token'
  const inputQuery = 'query { f }'

  const config = {
    name: 'function',
    type: 'function',
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
      handle: 'linked-ext-handle',
    },
    configuration_ui: false,
    api_version: '2022-07',
    input: {
      variables: {
        namespace: 'namespace',
        key: 'key',
      },
    },
  }

  beforeEach(async () => {
    vi.spyOn(upload, 'uploadWasmBlob').mockResolvedValue({
      url: 'http://foo.bar',
      moduleId,
    })

    extension = await testFunctionExtension({
      dir: '/function',
      config: {...config},
    })
  })

  test('returns a snake_case object with all possible fields', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.directory = tmpDir
      await writeFile(extension.inputQueryPath, inputQuery)

      // When
      const got = await extension.deployConfig({apiKey, token})

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: apiKey,
        api_type: undefined,
        api_version: extension.configuration.api_version,
        ui: {
          app_bridge: {
            details_path: extension.configuration.ui!.paths!.details,
            create_path: extension.configuration.ui!.paths!.create,
          },
          ui_extension_handle: extension.configuration.ui!.handle,
        },
        input_query: inputQuery,
        input_query_variables: {
          single_json_metafield: {
            namespace: 'namespace',
            key: 'key',
          },
        },
        enable_creation_ui: true,
        localization: {},
        targets: undefined,
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
      const got = await extension.deployConfig({apiKey, token})

      // Then
      expect(got).toEqual({
        title: extension.configuration.name,
        description: extension.configuration.description,
        app_key: apiKey,
        api_type: undefined,
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
      const got = await extension.deployConfig({apiKey, token})

      // Then
      expect(getPathValue(got!, 'targets')).toEqual([
        {handle: 'some.api.target1', input_query: inputQuery},
        {handle: 'some.api.target2', export: 'run_target2'},
      ])
    })
  })

  test('aborts when an target input query file is missing', async () => {
    // Given
    extension.configuration.targeting = [{target: 'some.api.target1', input_query: 'this-is-not-a-file.graphql'}]

    // When & Then
    await expect(() => extension.deployConfig({apiKey, token})).rejects.toThrowError(AbortError)
  })

  describe('with legacy type', async () => {
    beforeEach(async () => {
      extension = await testFunctionExtension({
        config: {
          ...config,
          type: 'order_discounts',
          targeting: undefined,
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
        const got = await extension.deployConfig({apiKey, token})

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
            ui_extension_handle: extension.configuration.ui!.handle,
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
        const got = await extension.deployConfig({apiKey, token})

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
      const got = await extension.deployConfig({apiKey, token})

      // Then
      const expectedLocalization = {
        default_locale: 'en',
        translations: {
          en: 'eyJleHRlbnNpb24iOnsidGl0bGUiOiJFbmdsaXNoIFRpdGxlIiwiZGVzY3JpcHRpb24iOiJFbmdsaXNoIERlc2NyaXB0aW9uIn19',
        },
      }

      expect(getPathValue(got!, 'localization')).toEqual(expectedLocalization)
    })
  })

  test("parses ui.handle when it's an empty string", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.directory = tmpDir
      extension.configuration.ui!.handle = ''

      // When
      const got = (await extension.deployConfig({
        apiKey,
        token,
      })) as unknown as {ui: {ui_extension_handle: string}}

      // Then
      expect(got.ui?.ui_extension_handle).toStrictEqual('')
    })
  })

  test("parses ui.handle when it's undefined", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.directory = tmpDir
      extension.configuration.ui = undefined

      // When
      const got = (await extension.deployConfig({
        apiKey,
        token,
      })) as unknown as {ui: {ui_extension_handle: string}}

      // Then
      expect(got.ui?.ui_extension_handle).toBeUndefined()
    })
  })
})
