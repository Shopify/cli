import {updateAppIdentifiers, getAppIdentifiers} from './identifiers.js'
import {testApp, testAppWithConfig, testUIExtension} from './app.test-data.js'
import {describe, expect, test} from 'vitest'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists, inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('updateAppIdentifiers', () => {
  test('updates ids in memory when deploying without creating a new env file', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension()
      const app = testApp({
        directory: tmpDir,
        allExtensions: [uiExtension],
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
      await expect(fileExists(joinPath(tmpDir, '.env'))).resolves.toBe(false)
      expect(gotApp.dotenv).toBeUndefined()
    })
  })

  test('does not write ids to the config-specific env file when deploying', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const dotEnvFilePath = joinPath(tmpDir, '.env.staging')
      await writeFile(dotEnvFilePath, '#comment\nEXISTING_VAR=value\nSHOPIFY_MY_EXTENSION_ID=OLDID\n#anothercomment')
      const uiExtension = await testUIExtension()
      const app = testAppWithConfig({
        app: {
          directory: tmpDir,
          configPath: joinPath(tmpDir, 'shopify.app.staging.toml'),
          allExtensions: [uiExtension],
        },
        config: {},
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
      const dotEnvFileContent = await readFile(dotEnvFilePath)
      const dotEnvFile = await readAndParseDotEnv(dotEnvFilePath)
      expect(dotEnvFileContent).toEqual('#comment\nEXISTING_VAR=value\nSHOPIFY_MY_EXTENSION_ID=OLDID\n#anothercomment')
      expect(dotEnvFile.variables.EXISTING_VAR).toEqual('value')
      expect(dotEnvFile.variables.SHOPIFY_API_KEY).toBeUndefined()
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('OLDID')
      expect(gotApp.dotenv?.variables.SHOPIFY_API_KEY).toBeUndefined()
      expect(gotApp.dotenv?.variables.SHOPIFY_MY_EXTENSION_ID).toBeUndefined()
    })
  })

  test("doesn't persist the ids that come from env vars when deploying", async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension()
      const app = testApp({
        directory: tmpDir,
        allExtensions: [uiExtension],
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

test('does not change a unified config TOML with multiple when the uid is already present', async () => {
  await inTemporaryDirectory(async (tmpDir: string) => {
    // Given
    const uiExtension1 = await testUIExtension({
      directory: tmpDir,
      configuration: {
        name: 'Extension 1',
        handle: 'ext1',
        type: 'ui_extension',
        metafields: [],
      },
    })
    const uiExtension2 = await testUIExtension({
      directory: tmpDir,
      configuration: {
        name: 'Extension 2',
        handle: 'ext2',
        type: 'ui_extension',
        metafields: [],
      },
    })
    const app = testApp({
      directory: tmpDir,
      allExtensions: [uiExtension1, uiExtension2],
    })
    await writeFile(
      uiExtension1.configurationPath,
      `api_version = "2024-04"
[[extensions]]
name = "t:name"
handle = "ext2"
uid = "${uiExtension2.uid}"
type = "ui_extension"

[[extensions]]
name = "t:name"
handle = "ext1"
uid = "${uiExtension1.uid}"
type = "ui_extension"`,
    )

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
    const fileContent = await readFile(uiExtension1.configurationPath)
    expect(fileContent).toEqual(`api_version = "2024-04"
[[extensions]]
name = "t:name"
handle = "ext2"
uid = "${uiExtension2.uid}"
type = "ui_extension"

[[extensions]]
name = "t:name"
handle = "ext1"
uid = "${uiExtension1.uid}"
type = "ui_extension"`)
  })
})

describe('getAppIdentifiers', () => {
  test('returns the right identifiers when variables are defined in the .env file', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension({
        directory: '/tmp/project/extensions/my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        dotenv: {
          path: joinPath(tmpDir, '.env'),
          variables: {SHOPIFY_API_KEY: 'FOO', SHOPIFY_TEST_UI_EXTENSION_ID: 'BAR'},
        },
        allExtensions: [uiExtension],
      })

      // When
      const got = getAppIdentifiers({
        app,
      })

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['test-ui-extension']).toEqual('BAR')
    })
  })

  test('returns the right identifiers when variables are defined in the system environment', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension({
        directory: '/tmp/project/extensions/my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        allExtensions: [uiExtension],
      })

      // When
      const got = getAppIdentifiers(
        {
          app,
        },
        {SHOPIFY_API_KEY: 'FOO', SHOPIFY_TEST_UI_EXTENSION_ID: 'BAR'},
      )

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['test-ui-extension']).toEqual('BAR')
    })
  })
})
