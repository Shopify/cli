import {load} from './loader.js'
import {configurationFileNames, blocks} from '../../constants.js'
import metadata from '../../metadata.js'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {yarnLockfile, pnpmLockfile, PackageJson, pnpmWorkspaceFile} from '@shopify/cli-kit/node/node-package-manager'

describe('load', () => {
  type BlockType = 'ui' | 'function' | 'theme'

  let tmpDir: string
  const appConfiguration = `
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

  const writeConfig = async (appConfiguration: string, packageJson?: PackageJson) => {
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
    await file.write(
      packageJsonPath,
      JSON.stringify(packageJson ?? {name: 'my_app', dependencies: {}, devDependencies: {}}),
    )
    await file.mkdir(webDirectory)
    await file.write(path.join(webDirectory, blocks.web.configurationName), webConfiguration)

    return {webDirectory, appConfigurationPath}
  }

  const blockPath = (name: string) => {
    return path.join(tmpDir, blocks.extensions.directoryName, name)
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
      ? path.join(directory, configurationName)
      : path.join(tmpDir, blocks.extensions.directoryName, name, configurationName)
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
    const dirname = path.dirname(blockConfigurationPath({blockType, name, directory}))
    await file.mkdir(dirname)
    return dirname
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
    await file.write(configPath, blockConfiguration)
    return {blockDir, configPath}
  }

  it("throws an error if the directory doesn't exist", async () => {
    await file.inTemporaryDirectory(async (tmp) => {
      // Given
      await file.rmdir(tmp, {force: true})

      // When/Then
      await expect(load(tmp)).rejects.toThrow(`Couldn't find directory ${tmp}`)
    })
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // Given
    const currentDir = process.cwd()

    // When/Then
    await expect(load(currentDir)).rejects.toThrow(`Couldn't find the configuration file for ${currentDir}`)
  })

  it('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        scopes = 1
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
    expect(app.name).toBe('my_app')
  })

  it('defaults to npm as the package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('npm')
  })

  it('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const yarnLockPath = path.join(tmpDir, yarnLockfile)
    await file.write(yarnLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('yarn')
  })

  it('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmLockPath = path.join(tmpDir, pnpmLockfile)
    await file.write(pnpmLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  it("identifies if the app doesn't use workspaces", async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.usesWorkspaces).toBe(false)
  })

  it('identifies if the app uses yarn or npm workspaces', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  it('identifies if the app uses pnpm workspaces', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmWorkspaceFilePath = path.join(tmpDir, pnpmWorkspaceFile)
    await file.write(pnpmWorkspaceFilePath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  it("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({blockType: 'ui', name: 'my-extension'})

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

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })
    await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui[0]!.configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.extensions.ui[0]!.localIdentifier).toBe('my-extension')
  })

  it('loads the app when it has a extension with a valid configuration using a supported extension type', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "post_purchase_ui"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })
    await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui[0]!.configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.extensions.ui[0]!.localIdentifier).toBe('my-extension')
  })

  it('loads the app when it has a extension with a valid configuration using a supported extension type and in a non-conventional directory configured in the app configuration file', async () => {
    // Given
    await writeConfig(`
    scopes = ""
    extension_directories = ["custom_extension"]
    `)
    const customExtensionDirectory = path.join(tmpDir, 'custom_extension')
    await file.mkdir(customExtensionDirectory)

    const blockConfiguration = `
      name = "custom_extension"
      type = "post_purchase_ui"
    `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'custom-extension',
      directory: customExtensionDirectory,
    })
    await file.write(path.join(customExtensionDirectory, 'index.js'), '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui[0]!.configuration.name).toBe('custom_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_CUSTOM_EXTENSION_ID')
    expect(app.extensions.ui[0]!.localIdentifier).toBe('custom_extension')
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
    await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load(blockDir)

    // Then
    expect(app.name).toBe('my_app')
    expect(app.extensions.ui[0]!.configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
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
    await file.write(path.join(blockPath('my_extension_1'), 'index.js'), '')

    blockConfiguration = `
      name = "my_extension_2"
      type = "product_subscription"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my_extension_2',
    })
    await file.write(path.join(blockPath('my_extension_2'), 'index.js'), '')

    // When
    const app = await load(tmpDir)

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

  it('loads the app supports extensions with the following sources paths: index.js, index.jsx, src/index.js, src/index.jsx', async () => {
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
        const sourceAbsolutePath = path.join(blockPath(`my_extension_${index}`), sourcePath)
        await file.mkdir(path.dirname(sourceAbsolutePath))
        await file.write(sourceAbsolutePath, '')
      }),
    )

    // When
    await expect(load(tmpDir)).resolves.not.toBeUndefined()
  })

  it(`throws an error if the extension doesn't have a source file`, async () => {
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
    await expect(load(blockDir)).rejects.toThrow(/Couldn't find an index.{js,jsx,ts,tsx} file in the directories/)
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({blockType: 'function', name: 'my-functions'})

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
    await expect(() => load(tmpDir)).rejects.toThrowError()
  })

  it('loads the app when it has a function with a valid configuration', async () => {
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

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0]!.configuration.name).toBe('my-function')
    expect(app.extensions.function[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_ID')
    expect(app.extensions.function[0]!.localIdentifier).toBe('my-function')
  })

  it('loads the app with several functions that have valid configurations', async () => {
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
    const app = await load(tmpDir)

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

  it(`uses a custom function wasm path if configured`, async () => {
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
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0]!.buildWasmPath()).toMatch(/wasm32-wasi\/release\/my-function.wasm/)
  })

  it(`defaults the function wasm path if not configured`, async () => {
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
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0]!.buildWasmPath()).toMatch(/.+dist\/index.wasm$/)
  })

  it(`updates metadata after loading`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration)
    await file.write(path.join(webDirectory, 'package.json'), JSON.stringify({}))

    await load(tmpDir)

    expect(metadata.getAllPublic()).toMatchObject({project_type: 'node', env_package_manager_workspaces: false})
  })

  it(`updates metadata after loading with a flag that indicates the usage of workspaces`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })
    await file.write(path.join(webDirectory, 'package.json'), JSON.stringify({}))

    await load(tmpDir)

    expect(metadata.getAllPublic()).toMatchObject({project_type: 'node', env_package_manager_workspaces: true})
  })

  describe('customer_accounts_ui_extension', () => {
    it('should not throw when "authenticatedRedirectStartUrl" and "authenticatedRedirectRedirectUrls" are unset', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).resolves.toBeDefined()
    })

    it('should not throw when "authenticatedRedirectStartUrl" and "authenticatedRedirectRedirectUrls" are set and valid', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).resolves.toBeDefined()
    })

    it('should throw when "authenticatedRedirectStartUrl" is not a valid URL', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).rejects.toThrow(/authenticated_redirect_start_url must be a valid URL./)
    })

    it('should throw when "authenticatedRedirectStartUrl" is an empty string', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).rejects.toThrow(/authenticated_redirect_start_url must be a valid URL./)
    })

    it('should throw when "authenticatedRedirectRedirectUrls" contains an invalid URL', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).rejects.toThrow(/authenticated_redirect_redirect_urls does contain invalid URLs./)
    })

    it('should throw when one of the "authenticatedRedirectRedirectUrls" is an invalid URL', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).rejects.toThrow(/authenticated_redirect_redirect_urls does contain invalid URLs./)
    })

    it('should throw when "authenticatedRedirectRedirectUrls" is an empty array', async () => {
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
      await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(load(tmpDir)).rejects.toThrow(
        /authenticated_redirect_redirect_urls can not be an empty array! It may only contain one or multiple valid URLs./,
      )
    })
  })
})
