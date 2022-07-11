import {updateAppIdentifiers, getAppIdentifiers} from './identifiers.js'
import {testApp, testUIExtension} from './app.test-data.js'
import {describe, expect, test} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'

describe('updateAppIdentifiers', () => {
  test("persists the ids that are not environment variables in the system and it's deploy", async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension()
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
            // eslint-disable-next-line @typescript-eslint/naming-convention
            my_extension: 'BAR',
          },
        },
        command: 'deploy',
      })

      // Then
      const dotEnvFile = await readAndParseDotEnv(path.join(tmpDir, '.env'))
      expect(dotEnvFile.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
      expect(gotApp.dotenv?.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(gotApp.dotenv?.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
    })
  })

  test("doesn't persist the ids that come from the system's environment and it's deploy", async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension()
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
              // eslint-disable-next-line @typescript-eslint/naming-convention
              my_extension: 'BAR',
            },
          },
          command: 'deploy',
        },
        {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
      )

      // Then
      const dotEnvFilePath = path.join(tmpDir, '.env')
      if (await file.exists(dotEnvFilePath)) {
        const dotEnvFile = await readAndParseDotEnv(dotEnvFilePath)
        expect(dotEnvFile.variables.SHOPIFY_API_KEY).toBeUndefined()
        expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toBeUndefined()
      }
    })
  })
})

describe('getAppIdentifiers', () => {
  test('returns the right identifiers when variables are defined in the .env file', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension({
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        dotenv: {
          path: path.join(tmpDir, '.env'),
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
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension({
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
