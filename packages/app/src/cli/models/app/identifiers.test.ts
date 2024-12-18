import {updateAppIdentifiers, getAppIdentifiers} from './identifiers.js'
import {testApp, testAppWithConfig, testDeveloperPlatformClient, testUIExtension} from './app.test-data.js'
import {describe, expect, test} from 'vitest'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists, inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('updateAppIdentifiers', () => {
  test('persists the ids that are not env variables when deploying, creating a new file', async () => {
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
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      // Then
      const dotEnvFile = await readAndParseDotEnv(joinPath(tmpDir, '.env'))
      expect(dotEnvFile.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
      expect(gotApp.dotenv?.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(gotApp.dotenv?.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
    })
  })

  test('persists the ids in the config-specific env file when deploying, updating the existing file', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const dotEnvFilePath = joinPath(tmpDir, '.env.staging')
      await writeFile(dotEnvFilePath, '#comment\nEXISTING_VAR=value\nSHOPIFY_MY_EXTENSION_ID=OLDID\n#anothercomment')
      const uiExtension = await testUIExtension()
      const app = testAppWithConfig({
        app: {
          directory: tmpDir,
          allExtensions: [uiExtension],
        },
        config: {
          path: joinPath(tmpDir, 'shopify.app.staging.toml'),
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
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      // Then
      const dotEnvFileContent = await readFile(dotEnvFilePath)
      const dotEnvFile = await readAndParseDotEnv(dotEnvFilePath)
      expect(dotEnvFileContent).toEqual(
        '#comment\nEXISTING_VAR=value\nSHOPIFY_MY_EXTENSION_ID=BAR\n#anothercomment\nSHOPIFY_API_KEY=FOO',
      )
      expect(dotEnvFile.variables.EXISTING_VAR).toEqual('value')
      expect(dotEnvFile.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
      expect(gotApp.dotenv?.variables.SHOPIFY_API_KEY).toEqual('FOO')
      expect(gotApp.dotenv?.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
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
          developerPlatformClient: testDeveloperPlatformClient(),
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

  test('adds the missing uid to a simple TOML for atomic deployments', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const uiExtension = await testUIExtension({directory: tmpDir})
      const app = testApp({
        directory: tmpDir,
        allExtensions: [uiExtension],
      })
      await writeFile(
        uiExtension.configurationPath,
        `name = "tae"
type = "theme"`,
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
          developerPlatformClient: testDeveloperPlatformClient({supportsAtomicDeployments: true}),
        },
        {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
      )

      // Then
      const fileContent = await readFile(uiExtension.configurationPath)
      expect(fileContent).toEqual(`name = "tae"
uid = "${uiExtension.uid}"
type = "theme"`)
    })
  })
})

test('does not change a simple TOML when the uid is already present for atomic deployments', async () => {
  await inTemporaryDirectory(async (tmpDir: string) => {
    // Given
    const uiExtension = await testUIExtension({directory: tmpDir})
    const app = testApp({
      directory: tmpDir,
      allExtensions: [uiExtension],
    })
    await writeFile(
      uiExtension.configurationPath,
      `name = "tae"
uid = "${uiExtension.uid}"
type = "theme"`,
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
        developerPlatformClient: testDeveloperPlatformClient({supportsAtomicDeployments: true}),
      },
      {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
    )

    // Then
    const fileContent = await readFile(uiExtension.configurationPath)
    expect(fileContent).toEqual(`name = "tae"
uid = "${uiExtension.uid}"
type = "theme"`)
  })
})

test('adds the missing uid to a unified config TOML for atomic deployments', async () => {
  await inTemporaryDirectory(async (tmpDir: string) => {
    // Given
    const uiExtension = await testUIExtension({
      directory: tmpDir,
      configuration: {
        name: 'Extension 1',
        handle: 'ext1',
        type: 'ui_extension',
        metafields: [],
      },
    })
    const app = testApp({
      directory: tmpDir,
      allExtensions: [uiExtension],
    })
    await writeFile(
      uiExtension.configurationPath,
      `api_version = "2024-04"
[[extensions]]
name = "Extension 1"
handle = "ext1"
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
        developerPlatformClient: testDeveloperPlatformClient({supportsAtomicDeployments: true}),
      },
      {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
    )

    // Then
    const fileContent = await readFile(uiExtension.configurationPath)
    expect(fileContent).toEqual(`api_version = "2024-04"
[[extensions]]
name = "Extension 1"
handle = "ext1"
uid = "${uiExtension.uid}"
type = "ui_extension"`)
  })
})

test('does not change a unified config TOML when the uid is already present for atomic deployments', async () => {
  await inTemporaryDirectory(async (tmpDir: string) => {
    // Given
    const uiExtension = await testUIExtension({
      directory: tmpDir,
      configuration: {
        name: 'Extension 1',
        handle: 'ext1',
        type: 'ui_extension',
        metafields: [],
      },
    })
    const app = testApp({
      directory: tmpDir,
      allExtensions: [uiExtension],
    })
    await writeFile(
      uiExtension.configurationPath,
      `api_version = "2024-04"
[[extensions]]
name = "Extension 1"
handle = "ext1"
uid = "${uiExtension.uid}"
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
        developerPlatformClient: testDeveloperPlatformClient({supportsAtomicDeployments: true}),
      },
      {SHOPIFY_API_KEY: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
    )

    // Then
    const fileContent = await readFile(uiExtension.configurationPath)
    expect(fileContent).toEqual(`api_version = "2024-04"
[[extensions]]
name = "Extension 1"
handle = "ext1"
uid = "${uiExtension.uid}"
type = "ui_extension"`)
  })
})

test('adds the missing uids to a unified config TOML with multiple extensions for atomic deployments', async () => {
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
type = "ui_extension"

[[extensions]]
name = "t:name"
handle = "ext1"
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
        developerPlatformClient: testDeveloperPlatformClient({supportsAtomicDeployments: true}),
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

test('does not change a unified config TOML with multiple when the uid is already present for atomic deployments', async () => {
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
        developerPlatformClient: testDeveloperPlatformClient({supportsAtomicDeployments: true}),
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
      const got = getAppIdentifiers(
        {
          app,
        },
        testDeveloperPlatformClient(),
      )

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
        testDeveloperPlatformClient(),
        {SHOPIFY_API_KEY: 'FOO', SHOPIFY_TEST_UI_EXTENSION_ID: 'BAR'},
      )

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['test-ui-extension']).toEqual('BAR')
    })
  })

  test('returns the UIDs when Atomic Deployments is enabled', async () => {
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
      const got = getAppIdentifiers(
        {
          app,
        },
        testDeveloperPlatformClient({supportsAtomicDeployments: true}),
      )

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['test-ui-extension']).toEqual(uiExtension.uid)
    })
  })
})
