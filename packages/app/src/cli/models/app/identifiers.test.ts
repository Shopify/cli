import {updateAppIdentifiers, getAppIdentifiers} from './identifiers.js'
import {testApp, testUIExtension} from './app.test-data.js'
import {describe, expect, test} from 'vitest'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('updateAppIdentifiers', () => {
  test("persists the ids that are not environment variables in the system and it's deploy", async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension()
      const app = testApp({
        directory: tmpDir,
        extensions: {
          ui: [uiExtension],
          function: [],
          theme: [],
        },
      })

      // When
      const gotApp = await updateAppIdentifiers({
        app,
        identifiers: {
          app: 'FOO',
          extensions: {
            my_extension: 'BAR',
          },
        },
        command: 'deploy',
      })

      // Then
      const dotEnvFile = await readAndParseDotEnv(joinPath(tmpDir, '.env'))
      expect(dotEnvFile.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
      expect(gotApp.dotenv?.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(gotApp.dotenv?.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
    })
  })

  test("doesn't persist the ids that come from the system's environment and it's deploy", async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension()
      const app = testApp({
        directory: tmpDir,
        extensions: {
          ui: [uiExtension],
          function: [],
          theme: [],
        },
      })

      // When
      await updateAppIdentifiers(
        {
          app,
          identifiers: {
            app: 'FOO',
            extensions: {
              my_extension: 'BAR',
            },
          },
          command: 'deploy',
        },
        {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
      )

      // Then
      const dotEnvFilePath = joinPath(tmpDir, '.env')
      if (await fileExists(dotEnvFilePath)) {
        const dotEnvFile = await readAndParseDotEnv(dotEnvFilePath)
        expect(dotEnvFile.variables.SHOPIFY_API_KEY).toBeUndefined()
        expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toBeUndefined()
      }
    })
  })
})

describe('getAppIdentifiers', () => {
  test('returns the right identifiers when variables are defined in the .env file', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension({
        directory: '/tmp/project/extensions/my-extension',
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        dotenv: {
          path: joinPath(tmpDir, '.env'),
          variables: {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
        },
        extensions: {
          ui: [uiExtension],
          function: [],
          theme: [],
        },
      })

      // When
      const got = await getAppIdentifiers({
        app,
      })

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['my-extension']).toEqual('BAR')
    })
  })

  test('returns the right identifiers when variables are defined in the system environment', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension({
        directory: '/tmp/project/extensions/my-extension',
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        extensions: {
          ui: [uiExtension],
          function: [],
          theme: [],
        },
      })

      // When
      const got = await getAppIdentifiers(
        {
          app,
        },
        {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
      )

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['my-extension']).toEqual('BAR')
    })
  })
})
