import {FunctionConfigType} from './function.js'
import {testFunctionExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import * as upload from '../../../services/deploy/upload.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/deploy/upload.js')

describe('functionConfiguration', async () => {
  let extension: ExtensionInstance<FunctionConfigType>
  const moduleId = 'module_id'
  const apiKey = 'app-key'
  const token = 'app-token'
  const unifiedDeployment = true

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
    },
    configuration_ui: false,
    api_version: '2023-10',
    input: {
      variables: {
        namespace: 'namespace',
        key: 'key',
      },
    },
    targeting: [{target: 'some.api.target1', input_query: 'target1.graphql'}],
  }

  beforeEach(async () => {
    vi.spyOn(upload, 'uploadWasmBlob').mockResolvedValue({
      url: 'http://foo.bar',
      moduleId,
    })
    extension = await testFunctionExtension({
      dir: '/function',
      config,
    })
  })

  describe('with targets', async () => {
    test('returns a snake_case object with all possible fields', async () => {
      // Given
      await inTemporaryDirectory(async (tmpDir) => {
        await writeFile(joinPath(tmpDir, 'target1.graphql'), inputQuery)
        extension.directory = tmpDir
        extension.configuration.targeting!.push({target: 'some.api.target2', export: 'run_target2'})

        // When
        const got = await extension.deployConfig({apiKey, token, unifiedDeployment})

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
          },
          input_query: undefined,
          input_query_variables: {
            single_json_metafield: {
              namespace: 'namespace',
              key: 'key',
            },
          },
          enable_creation_ui: true,
          module_id: moduleId,
          targets: [
            {handle: 'some.api.target1', input_query: inputQuery},
            {handle: 'some.api.target2', export: 'run_target2'},
          ],
        })
      })
    })

    test('returns a snake_case object with only required fields', async () => {
      // Given
      extension.configuration.input = undefined
      extension.configuration.ui = undefined
      extension.configuration.targeting = [{target: 'some.api.target1'}]

      // When
      const got = await extension.deployConfig({apiKey, token, unifiedDeployment})

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
        targets: [{handle: 'some.api.target1'}],
      })
    })

    test('aborts when a target input query file is missing', async () => {
      // Given
      extension.configuration.targeting = [{target: 'some.api.target1', input_query: 'this-is-not-a-file.graphql'}]

      // When
      const got = extension.deployConfig({apiKey, token, unifiedDeployment})

      // Then
      await expect(got).rejects.toThrowError(AbortError)
    })
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
      // Given
      await inTemporaryDirectory(async (tmpDir) => {
        const inputQuery = 'query { f }'
        extension.directory = tmpDir
        await writeFile(joinPath(tmpDir, 'input.graphql'), inputQuery)

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
          targets: undefined,
        })
      })
    })
  })

  test('returns a snake_case object with only required fields', async () => {
    // Given
    extension.configuration.input = undefined
    extension.configuration.ui = undefined
    extension.configuration.targeting = undefined
    extension.configuration.type = 'order_discounts'

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
    })
  })
})
