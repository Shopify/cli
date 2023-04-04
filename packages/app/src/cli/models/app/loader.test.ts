import {load} from './loader.js'
import {GenericSpecification} from './extensions.js'
import {configurationFileNames, blocks} from '../../constants.js'
import metadata from '../../metadata.js'
import {loadLocalExtensionsSpecifications} from '../extensions/specifications.js'
import {describe, expect, beforeEach, afterEach, beforeAll, test} from 'vitest'
import {yarnLockfile, pnpmLockfile, PackageJson, pnpmWorkspaceFile} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, moveFile, mkdir, mkTmpDir, rmdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, cwd} from '@shopify/cli-kit/node/path'

describe('load', () => {
  type BlockType = 'ui' | 'function' | 'theme'
  let specifications: GenericSpecification[] = []

  let tmpDir: string
  const appConfiguration = `
scopes = "read_products"
`

  beforeAll(async () => {
    specifications = await loadLocalExtensionsSpecifications()
  })

  beforeEach(async () => {
    tmpDir = await mkTmpDir()
  })

  afterEach(async () => {
    if (tmpDir) {
      await rmdir(tmpDir)
    }
  })

  const writeConfig = async (appConfiguration: string, packageJson?: PackageJson) => {
    const appConfigurationPath = joinPath(tmpDir, configurationFileNames.app)
    const packageJsonPath = joinPath(tmpDir, 'package.json')
    const webDirectory = joinPath(tmpDir, blocks.web.directoryName)
    const webConfiguration = `
    type = "backend"

    [commands]
    build = "build"
    dev = "dev"
    `
    await writeFile(appConfigurationPath, appConfiguration)
    await writeFile(
      packageJsonPath,
      JSON.stringify(packageJson ?? {name: 'my_app', dependencies: {}, devDependencies: {}}),
    )
    await mkdir(webDirectory)
    await writeFile(joinPath(webDirectory, blocks.web.configurationName), webConfiguration)

    return {webDirectory, appConfigurationPath}
  }

  const blockPath = (name: string) => {
    return joinPath(tmpDir, blocks.extensions.directoryName, name)
  }

  const blockConfigurationPath = ({
    blockType,
    name,
    directory,
  }: {
    blockType: BlockType
    name: string
    directory?: string
  }) => {
    const configurationName = blocks.extensions.configurationName[blockType]
    return directory
      ? joinPath(directory, configurationName)
      : joinPath(tmpDir, blocks.extensions.directoryName, name, configurationName)
  }

  const makeBlockDir = async ({
    blockType,
    name,
    directory,
  }: {
    blockType: BlockType
    name: string
    directory?: string
  }) => {
    const directoryName = dirname(blockConfigurationPath({blockType, name, directory}))
    await mkdir(directoryName)
    return directoryName
  }

  const writeBlockConfig = async ({
    blockType,
    blockConfiguration,
    name,
    directory,
  }: {
    blockType: BlockType
    blockConfiguration: string
    name: string
    directory?: string
  }) => {
    const blockDir = await makeBlockDir({blockType, name, directory})
    const configPath = blockConfigurationPath({blockType, name, directory})
    await writeFile(configPath, blockConfiguration)
    return {blockDir, configPath}
  }

  test("throws an error if the directory doesn't exist", async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      await rmdir(tmp, {force: true})

      // When/Then
      await expect(load({directory: tmp, specifications})).rejects.toThrow(`Couldn't find directory ${tmp}`)
    })
  })

  test("throws an error if the configuration file doesn't exist", async () => {
    // Given
    const currentDir = cwd()

    // When/Then
    await expect(load({directory: currentDir, specifications})).rejects.toThrow(
      `Couldn't find the configuration file for ${currentDir}`,
    )
  })

  test('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        scopes = 1
        `
    await writeConfig(appConfiguration)

    // When/Then
    await expect(load({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app when the configuration is valid and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
  })

  test('defaults to npm as the package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.packageManager).toBe('npm')
  })

  test('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const yarnLockPath = joinPath(tmpDir, yarnLockfile)
    await writeFile(yarnLockPath, '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.packageManager).toBe('yarn')
  })

  test('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmLockPath = joinPath(tmpDir, pnpmLockfile)
    await writeFile(pnpmLockPath, '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  test("identifies if the app doesn't use workspaces", async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.usesWorkspaces).toBe(false)
  })

  test('identifies if the app uses yarn or npm workspaces', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  test('identifies if the app uses pnpm workspaces', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmWorkspaceFilePath = joinPath(tmpDir, pnpmWorkspaceFile)
    await writeFile(pnpmWorkspaceFilePath, '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  test("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({blockType: 'ui', name: 'my-extension'})

    // When
    await expect(load({directory: tmpDir, specifications})).rejects.toThrow(/Couldn't find the configuration file/)
  })

  test('throws an error if the extension configuration file is invalid', async () => {
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
    await expect(load({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app with web blocks', async () => {
    // Given
    const {webDirectory} = await writeConfig(appConfiguration)
    await moveFile(webDirectory, joinPath(tmpDir, 'we_check_everywhere'))

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.webs.length).toBe(1)
    expect(app.webs[0]!.configuration.type).toBe('backend')
  })

  test('loads the app with custom located web blocks', async () => {
    // Given
    const {webDirectory} = await writeConfig(`
    scopes = ""
    web_directories = ["must_be_here"]
    `)
    await moveFile(webDirectory, joinPath(tmpDir, 'must_be_here'))

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.webs.length).toBe(1)
  })

  test('loads the app with custom located web blocks, only checks given directory', async () => {
    // Given
    const {webDirectory} = await writeConfig(`
    scopes = ""
    web_directories = ["must_be_here"]
    `)
    await moveFile(webDirectory, joinPath(tmpDir, 'cannot_be_here'))

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.webs.length).toBe(0)
  })

  test('loads the app when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.ui[0]!.configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.extensions.ui[0]!.localIdentifier).toBe('my-extension')
  })

  test('loads the app when it has a extension with a valid configuration using a supported extension type', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase_external"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.ui[0]!.configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.extensions.ui[0]!.localIdentifier).toBe('my-extension')
  })

  test('loads the app when it has a extension with a valid configuration using a supported extension type and in a non-conventional directory configured in the app configuration file', async () => {
    // Given
    await writeConfig(`
    scopes = ""
    extension_directories = ["custom_extension"]
    `)
    const customExtensionDirectory = joinPath(tmpDir, 'custom_extension')
    await mkdir(customExtensionDirectory)

    const blockConfiguration = `
      name = "custom_extension"
      type = "checkout_post_purchase_external"
    `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'custom-extension',
      directory: customExtensionDirectory,
    })
    await writeFile(joinPath(customExtensionDirectory, 'index.js'), '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.ui[0]!.configuration.name).toBe('custom_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_CUSTOM_EXTENSION_ID')
    expect(app.extensions.ui[0]!.localIdentifier).toBe('custom_extension')
  })

  test('loads the app from a extension directory when it has a extension with a valid configuration', async () => {
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
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load({directory: blockDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
    expect(app.extensions.ui[0]!.configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
  })

  test('loads the app with several extensions that have valid configurations', async () => {
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
    await writeFile(joinPath(blockPath('my_extension_1'), 'index.js'), '')

    blockConfiguration = `
      name = "my_extension_2"
      type = "product_subscription"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my_extension_2',
    })
    await writeFile(joinPath(blockPath('my_extension_2'), 'index.js'), '')

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.ui).toHaveLength(2)
    const extensions = app.extensions.ui.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(extensions[0]!.configuration.name).toBe('my_extension_1')
    expect(extensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_1_ID')
    expect(extensions[1]!.configuration.name).toBe('my_extension_2')
    expect(extensions[1]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_2_ID')
  })

  test('loads the app supports extensions with the following sources paths: index.js, index.jsx, src/index.js, src/index.jsx', async () => {
    // Given
    await writeConfig(appConfiguration)
    await Promise.all(
      ['index.js', 'index.jsx', 'src/index.js', 'src/index.jsx'].map(async (sourcePath, index) => {
        const blockConfiguration = `
        name = "my_extension_${index}"
        type = "checkout_post_purchase"
        `
        await writeBlockConfig({
          blockType: 'ui',
          blockConfiguration,
          name: `my_extension_${index}`,
        })
        const sourceAbsolutePath = joinPath(blockPath(`my_extension_${index}`), sourcePath)
        await mkdir(dirname(sourceAbsolutePath))
        await writeFile(sourceAbsolutePath, '')
      }),
    )

    // When
    await expect(load({directory: tmpDir, specifications})).resolves.not.toBeUndefined()
  })

  test(`throws an error if the extension doesn't have a source file`, async () => {
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
    await expect(load({directory: blockDir, specifications})).rejects.toThrow(
      /Couldn't find an index.{js,jsx,ts,tsx} file in the directories/,
    )
  })

  test('throws an error if the extension has a type non included in the specs', async () => {
    // Given
    const blockConfiguration = `
    name = "my-extension"
    type = "wrong_type"
    `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(() => load({directory: tmpDir, specifications})).rejects.toThrowError()
  })

  test("throws an error if the configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({blockType: 'function', name: 'my-functions'})

    // When
    await expect(load({directory: tmpDir, specifications})).rejects.toThrow(/Couldn't find the configuration file/)
  })

  test('throws an error if the function configuration file is invalid', async () => {
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
    await expect(() => load({directory: tmpDir, specifications})).rejects.toThrowError()
  })

  test('throws an error if the function has a type non included in the specs', async () => {
    // Given
    const blockConfiguration = `
    name = "my-function"
    type = "wrong_type"
    apiVersion = "2022-07"
    `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    await expect(() => load({directory: tmpDir, specifications})).rejects.toThrowError()
  })

  test('loads the app when it has a function with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "my-function"
      type = "order_discounts"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })
    await mkdir(joinPath(blockPath('my-function'), 'src'))
    await writeFile(joinPath(blockPath('my-function'), 'src', 'index.js'), '')

    // When
    const app = await load({directory: tmpDir, specifications})
    const myFunction = app.extensions.function[0]!

    // Then
    expect(myFunction.configuration.name).toBe('my-function')
    expect(myFunction.idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_ID')
    expect(myFunction.localIdentifier).toBe('my-function')
    expect(myFunction.entrySourceFilePath).toContain(joinPath(blockPath('my-function'), 'src', 'index.js'))
  })

  test('loads the app with several functions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)
    let blockConfiguration = `
      name = "my-function-1"
      type = "order_discounts"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function-1',
    })

    blockConfiguration = `
      name = "my-function-2"
      type = "product_discounts"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function-2',
    })

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.function).toHaveLength(2)
    const functions = app.extensions.function.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(functions[0]!.configuration.name).toBe('my-function-1')
    expect(functions[1]!.configuration.name).toBe('my-function-2')
    expect(functions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_1_ID')
    expect(functions[1]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_2_ID')
    expect(functions[0]!.localIdentifier).toBe('my-function-1')
    expect(functions[1]!.localIdentifier).toBe('my-function-2')
  })

  test(`uses a custom function wasm path if configured`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my-function"
      type = "order_discounts"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "target/wasm32-wasi/release/my-function.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.function[0]!.buildWasmPath).toMatch(/wasm32-wasi\/release\/my-function.wasm/)
  })

  test(`defaults the function wasm path if not configured`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my-function"
      type = "order_discounts"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await load({directory: tmpDir, specifications})

    // Then
    expect(app.extensions.function[0]!.buildWasmPath).toMatch(/.+dist\/index.wasm$/)
  })

  test(`updates metadata after loading`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration)
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await load({directory: tmpDir, specifications})

    expect(metadata.getAllPublicMetadata()).toMatchObject({project_type: 'node', env_package_manager_workspaces: false})
  })

  test(`updates metadata after loading with a flag that indicates the usage of workspaces`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await load({directory: tmpDir, specifications})

    expect(metadata.getAllPublicMetadata()).toMatchObject({project_type: 'node', env_package_manager_workspaces: true})
  })

  describe('customer_accounts_ui_extension', () => {
    test('should not throw when "authenticatedRedirectStartUrl" and "authenticatedRedirectRedirectUrls" are unset', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"
      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).resolves.toBeDefined()
    })

    test('should not throw when "authenticatedRedirectStartUrl" and "authenticatedRedirectRedirectUrls" are set and valid', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"

        authenticated_redirect_start_url = 'https://www.shopify.com/start'
        authenticated_redirect_redirect_urls = ['https://www.shopify.com/finalize', 'https://www.loop.com/finalize']

      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).resolves.toBeDefined()
    })

    test('should throw when "authenticatedRedirectStartUrl" is not a valid URL', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"

        authenticated_redirect_start_url = '/start-url'
      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).rejects.toThrow(
        /authenticated_redirect_start_url must be a valid URL./,
      )
    })

    test('should throw when "authenticatedRedirectStartUrl" is an empty string', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"

        authenticated_redirect_start_url = ''
      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).rejects.toThrow(
        /authenticated_redirect_start_url must be a valid URL./,
      )
    })

    test('should throw when "authenticatedRedirectRedirectUrls" contains an invalid URL', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"

        authenticated_redirect_redirect_urls = ['/start-url']
      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).rejects.toThrow(
        /authenticated_redirect_redirect_urls does contain invalid URLs./,
      )
    })

    test('should throw when one of the "authenticatedRedirectRedirectUrls" is an invalid URL', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"

        authenticated_redirect_redirect_urls = ['/start-url', 'https://www.shopify.com/', '/end-url']
      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).rejects.toThrow(
        /authenticated_redirect_redirect_urls does contain invalid URLs./,
      )
    })

    test('should throw when "authenticatedRedirectRedirectUrls" is an empty array', async () => {
      // Given
      await writeConfig(appConfiguration)
      const blockConfiguration = `
        name = "my_extension"
        type = "customer_accounts_ui_extension"

        authenticated_redirect_redirect_urls = []
      `
      await writeBlockConfig({
        blockType: 'ui',
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load({directory: tmpDir, specifications})).rejects.toThrow(
        /authenticated_redirect_redirect_urls can not be an empty array! It may only contain one or multiple valid URLs./,
      )
    })
  })
})
