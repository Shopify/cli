import {load, getUIExtensionRendererVersion, App, updateAppIdentifiers, getAppIdentifiers} from './app'
import {testApp, testUIExtension} from './app.test-data'
import {
  configurationFileNames,
  blocks,
  genericConfigurationFileNames,
  getUIExtensionRendererDependency,
} from '../../constants'
import {describe, it, expect, beforeEach, afterEach, test} from 'vitest'
import {file, path, dotenv} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'

describe('load', () => {
  type BlockType = 'ui' | 'function' | 'theme'

  let tmpDir: string
  const appConfiguration = `
name = "my_app"
scopes = "read_products"
`
  beforeEach(async () => {
    tmpDir = await file.mkTmpDir()
  })

  afterEach(async () => {
    if (tmpDir) {
      await file.rmdir(tmpDir)
    }
  })

  const writeConfig = async (appConfiguration: string) => {
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
    const packageJsonPath = path.join(tmpDir, 'package.json')
    const webDirectory = path.join(tmpDir, blocks.web.directoryName)
    const webConfiguration = `
    type = "backend"

    [commands]
    build = "build"
    dev = "dev"
    `
    await file.write(appConfigurationPath, appConfiguration)
    await file.write(packageJsonPath, JSON.stringify({dependencies: {}, devDependencies: {}}))
    await file.mkdir(webDirectory)
    await file.write(path.join(webDirectory, blocks.web.configurationName), webConfiguration)
  }

  const blockConfigurationPath = ({blockType, name}: {blockType: BlockType; name: string}) => {
    const configurationName = blocks.extensions.configurationName[blockType]
    return path.join(tmpDir, blocks.extensions.directoryName, name, configurationName)
  }

  const makeBlockDir = async ({blockType, name}: {blockType: BlockType; name: string}) => {
    const dirname = path.dirname(blockConfigurationPath({blockType, name}))
    await file.mkdir(dirname)
    return dirname
  }

  const writeBlockConfig = async ({
    blockType,
    blockConfiguration,
    name,
  }: {
    blockType: BlockType
    blockConfiguration: string
    name: string
  }) => {
    const blockDir = await makeBlockDir({blockType, name})
    const configPath = blockConfigurationPath({blockType, name})
    await file.write(configPath, blockConfiguration)
    return {blockDir, configPath}
  }

  it("throws an error if the directory doesn't exist", async () => {
    // Given
    const directory = '/tmp/doesnt/exist'

    // When/Then
    await expect(load(directory)).rejects.toThrow(/Couldn't find directory/)
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // When/Then
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        wrong = "my_app"
        `
    await writeConfig(appConfiguration)

    // When/Then
    await expect(load(tmpDir)).rejects.toThrow()
  })

  it('loads the app when the configuration is valid and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.configuration.name).toBe('my_app')
  })

  it('defaults to npm as package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.dependencyManager).toBe('npm')
  })

  it('defaults to yarn st the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const yarnLockPath = path.join(tmpDir, genericConfigurationFileNames.yarn.lockfile)
    await file.write(yarnLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.dependencyManager).toBe('yarn')
  })

  it('defaults to pnpm st the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmLockPath = path.join(tmpDir, genericConfigurationFileNames.pnpm.lockfile)
    await file.write(pnpmLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.dependencyManager).toBe('pnpm')
  })

  it("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'ui', name: 'my-extension'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the extension configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my_extension"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrow()
  })

  it('loads the app when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui[0].configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.extensions.ui[0].localIdentifier).toBe('my-extension')
  })

  it('loads the app from a extension directory when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    const app = await load(blockDir)

    // Then
    expect(app.configuration.name).toBe('my_app')
    expect(app.extensions.ui[0].configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
  })

  it('loads the app with several extensions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)

    let blockConfiguration = `
      name = "my_extension_1"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my_extension_1',
    })

    blockConfiguration = `
      name = "my_extension_2"
      type = "product_subscription"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my_extension_2',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui).toHaveLength(2)
    const extensions = app.extensions.ui.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(extensions[0].configuration.name).toBe('my_extension_1')
    expect(extensions[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_1_ID')
    expect(extensions[1].configuration.name).toBe('my_extension_2')
    expect(extensions[1].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_2_ID')
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'function', name: 'my-functions'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the function configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my-function"
    `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrowError()
  })

  it('loads the app when it has a functions with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "my-function"
      type = "payment_methods"
      title = "my-function"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0].configuration.name).toBe('my-function')
    expect(app.extensions.function[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_ID')
    expect(app.extensions.function[0].localIdentifier).toBe('my-function')
  })

  it('loads the app with several functions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)
    let blockConfiguration = `
      name = "my-function-1"
      type = "payment_methods"
      title = "my-function-1"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function-1',
    })

    blockConfiguration = `
      name = "my-function-2"
      type = "product_discount_type"
      title = "my-function-2"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function-2',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function).toHaveLength(2)
    const functions = app.extensions.function.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(functions[0].configuration.name).toBe('my-function-1')
    expect(functions[1].configuration.name).toBe('my-function-2')
    expect(functions[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_1_ID')
    expect(functions[1].idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_2_ID')
    expect(functions[0].localIdentifier).toBe('my-function-1')
    expect(functions[1].localIdentifier).toBe('my-function-2')
  })
})

describe('updateAppIdentifiers', () => {
  test("persists the ids that are not environment variables in the system and it's local", async () => {
    await temporary.directory(async (tmpDir: string) => {
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
        environmentType: 'local',
      })

      // Then
      const dotEnvFile = await dotenv.read(path.join(tmpDir, '.env.local'))
      expect(dotEnvFile.variables.SHOPIFY_APP_ID).toEqual('FOO')
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
      expect(gotApp.environment.dotenv.local?.variables.SHOPIFY_APP_ID).toEqual('FOO')
      expect(gotApp.environment.dotenv.local?.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
    })
  })

  test("persists the ids that are not environment variables in the system and it's production", async () => {
    await temporary.directory(async (tmpDir: string) => {
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
        environmentType: 'production',
      })

      // Then
      const dotEnvFile = await dotenv.read(path.join(tmpDir, '.env'))
      expect(dotEnvFile.variables.SHOPIFY_APP_ID).toEqual('FOO')
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
      expect(gotApp.environment.dotenv.production?.variables.SHOPIFY_APP_ID).toEqual('FOO')
      expect(gotApp.environment.dotenv.production?.variables.SHOPIFY_MY_EXTENSION_ID).toEqual('BAR')
    })
  })

  test("doesn't persist the ids that come from the system's environment and it's local", async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension()
      const app = testApp({
        directory: tmpDir,
        environment: {
          dotenv: {},
          env: {
            SHOPIFY_APP_ID: 'ENV_FOO',
            SHOPIFY_MY_EXTENSION_ID: 'ENV_BAR',
          },
        },
        extensions: {
          ui: [uiExtension],
          function: [],
          theme: [],
        },
      })

      // When
      await updateAppIdentifiers({
        app,
        identifiers: {
          app: 'FOO',
          extensions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            my_extension: 'BAR',
          },
        },
        environmentType: 'local',
      })

      // Then
      const dotEnvFile = await dotenv.read(path.join(tmpDir, '.env.local'))
      expect(dotEnvFile.variables.SHOPIFY_APP_ID).toBeUndefined()
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toBeUndefined()
    })
  })

  test("doesn't persist the ids that come from the system's environment and it's production", async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension()
      const app = testApp({
        directory: tmpDir,
        environment: {
          dotenv: {},
          env: {
            SHOPIFY_APP_ID: 'ENV_FOO',
            SHOPIFY_MY_EXTENSION_ID: 'ENV_BAR',
          },
        },
        extensions: {
          ui: [uiExtension],
          function: [],
          theme: [],
        },
      })

      // When
      await updateAppIdentifiers({
        app,
        identifiers: {
          app: 'FOO',
          extensions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            my_extension: 'BAR',
          },
        },
        environmentType: 'production',
      })

      // Then
      const dotEnvFile = await dotenv.read(path.join(tmpDir, '.env'))
      expect(dotEnvFile.variables.SHOPIFY_APP_ID).toBeUndefined()
      expect(dotEnvFile.variables.SHOPIFY_MY_EXTENSION_ID).toBeUndefined()
    })
  })
})

describe('getAppIdentifiers', () => {
  test('returns the right identifiers when variables are defined in the .env.local file', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension({
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        environment: {
          dotenv: {
            local: {
              path: path.join(tmpDir, '.env.local'),
              variables: {SHOPIFY_APP_ID: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
            },
          },
          env: {},
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
        environmentType: 'local',
      })

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['my-extension']).toEqual('BAR')
    })
  })

  test('returns the right identifiers when variables are defined in the system environment', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension({
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        environment: {
          dotenv: {},
          env: {SHOPIFY_APP_ID: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
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
        environmentType: 'local',
      })

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['my-extension']).toEqual('BAR')
    })
  })

  test('returns the right identifiers when variables are defined in the .env file', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension({
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        environment: {
          dotenv: {
            production: {
              path: path.join(tmpDir, '.env'),
              variables: {SHOPIFY_APP_ID: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
            },
          },
          env: {},
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
        environmentType: 'production',
      })

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['my-extension']).toEqual('BAR')
    })
  })

  test('returns the right identifiers when variables are defined in the system environment', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const uiExtension = testUIExtension({
        localIdentifier: 'my-extension',
        idEnvironmentVariableName: 'SHOPIFY_MY_EXTENSION_ID',
      })
      const app = testApp({
        directory: tmpDir,
        environment: {
          dotenv: {},
          env: {SHOPIFY_APP_ID: 'FOO', SHOPIFY_MY_EXTENSION_ID: 'BAR'},
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
        environmentType: 'production',
      })

      // Then
      expect(got.app).toEqual('FOO')
      expect((got.extensions ?? {})['my-extension']).toEqual('BAR')
    })
  })
})

describe('getUIExtensionRendererVersion', () => {
  test("returns undefined when the UI extension type doesn't have a runtime dependency", () => {
    // Given/When
    const app: App = {
      idEnvironmentVariableName: 'SHOPIFY_APP_ID',
      configuration: {
        name: 'App',
        scopes: '',
      },
      dependencyManager: 'yarn',
      directory: '/tmp/project',
      extensions: {
        ui: [],
        function: [],
        theme: [],
      },
      webs: [],
      nodeDependencies: {},
      environment: {
        dotenv: {},
        env: {},
      },
      configurationPath: '/tmp/project/shopify.app.toml',
    }
    const got = getUIExtensionRendererVersion('beacon_extension', app)

    // Then
    expect(got).to.toBeUndefined()
  })

  test('returns undefined when the renderer dependency is not a dependency of the app', () => {
    // Given/When
    const app: App = {
      idEnvironmentVariableName: 'SHOPIFY_APP_ID',
      configuration: {
        name: 'App',
        scopes: '',
      },
      dependencyManager: 'yarn',
      directory: '/tmp/project',
      extensions: {
        ui: [],
        function: [],
        theme: [],
      },
      webs: [],
      nodeDependencies: {},
      environment: {
        dotenv: {},
        env: {},
      },
      configurationPath: '/tmp/project/shopify.app.toml',
    }
    const got = getUIExtensionRendererVersion('product_subscription', app)

    // Then
    expect(got).to.toBeUndefined()
  })

  test('returns the name of the renderer package and the version if it is dependency of the app', () => {
    // Given/When
    const nodeDependencies: {[key: string]: string} = {}
    const rendererDependency = getUIExtensionRendererDependency('product_subscription') as string
    nodeDependencies[rendererDependency] = '1.2.3'
    const app: App = {
      idEnvironmentVariableName: 'SHOPIFY_APP_ID',
      configuration: {
        name: 'App',
        scopes: '',
      },
      dependencyManager: 'yarn',
      directory: '/tmp/project',
      extensions: {
        ui: [],
        function: [],
        theme: [],
      },
      webs: [],
      nodeDependencies,
      environment: {
        dotenv: {},
        env: {},
      },
      configurationPath: '/tmp/project/shopify.app.toml',
    }
    const got = getUIExtensionRendererVersion('product_subscription', app)

    // Then
    expect(got?.name).to.toEqual(rendererDependency)
    expect(got?.version).toEqual('1.2.3')
  })
})
