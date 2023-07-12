import {getAppConfigurationShorthand, getAppConfigurationFileName, loadApp, loadDotEnv} from './loader.js'
import {configurationFileNames, blocks} from '../../constants.js'
import metadata from '../../metadata.js'
import {loadFSExtensionsSpecifications} from '../extensions/load-specifications.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {describe, expect, beforeEach, afterEach, beforeAll, test} from 'vitest'
import {
  installNodeModules,
  yarnLockfile,
  pnpmLockfile,
  PackageJson,
  pnpmWorkspaceFile,
} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, moveFile, mkdir, mkTmpDir, rmdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, cwd} from '@shopify/cli-kit/node/path'

describe('load', () => {
  let specifications: ExtensionSpecification[] = []

  let tmpDir: string
  const appConfiguration = `
scopes = "read_products"
`
  const linkedAppConfiguration = `
name = "for-testing"
api_contact_email = "me@example.com"
client_id = "1234567890"
application_url = "https://example.com/lala"
embedded = true

[webhooks]
api_version = "2023-07"

[build]
automatically_update_urls_on_dev = true
`

  beforeAll(async () => {
    specifications = await loadFSExtensionsSpecifications()
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
    await writeFile(appConfigurationPath, appConfiguration)
    await writeFile(
      packageJsonPath,
      JSON.stringify(packageJson ?? {name: 'my_app', dependencies: {}, devDependencies: {}}),
    )
    await mkdir(webDirectory)
    await writeWebConfiguration({role: 'backend', webDirectory})

    return {webDirectory, appConfigurationPath}
  }

  const writeWebConfiguration = async ({role, webDirectory}: {role: string; webDirectory: string}) => {
    const webConfiguration = `
    type = "${role}"

    [commands]
    build = "build"
    dev = "dev"
    `
    await writeFile(joinPath(webDirectory, blocks.web.configurationName), webConfiguration)
  }

  const blockPath = (name: string) => {
    return joinPath(tmpDir, blocks.extensions.directoryName, name)
  }

  const blockConfigurationPath = ({name, directory}: {name: string; directory?: string}) => {
    const configurationName = 'shopify.extension.toml'
    return directory
      ? joinPath(directory, configurationName)
      : joinPath(tmpDir, blocks.extensions.directoryName, name, configurationName)
  }

  const makeBlockDir = async ({name, directory}: {name: string; directory?: string}) => {
    const directoryName = dirname(blockConfigurationPath({name, directory}))
    await mkdir(directoryName)
    return directoryName
  }

  const writeBlockConfig = async ({
    blockConfiguration,
    name,
    directory,
  }: {
    blockConfiguration: string
    name: string
    directory?: string
  }) => {
    const blockDir = await makeBlockDir({name, directory})
    const configPath = blockConfigurationPath({name, directory})
    await writeFile(configPath, blockConfiguration)
    return {blockDir, configPath}
  }

  const configAsCodeLegacyMetadata = () => ({
    cmd_app_all_configs_any: false,
    cmd_app_all_configs_clients: JSON.stringify({}),
    cmd_app_linked_config_used: false,
  })

  test("throws an error if the directory doesn't exist", async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      await rmdir(tmp, {force: true})

      // When/Then
      await expect(loadApp({directory: tmp, specifications})).rejects.toThrow(`Couldn't find directory ${tmp}`)
    })
  })

  test("throws an error if the configuration file doesn't exist", async () => {
    // Given
    const currentDir = cwd()

    // When/Then
    await expect(loadApp({directory: currentDir, specifications})).rejects.toThrow(
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
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app when the configuration is valid and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
  })

  test('defaults to npm as the package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.packageManager).toBe('npm')
  })

  test('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const yarnLockPath = joinPath(tmpDir, yarnLockfile)
    await writeFile(yarnLockPath, '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.packageManager).toBe('yarn')
  })

  test('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmLockPath = joinPath(tmpDir, pnpmLockfile)
    await writeFile(pnpmLockPath, '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  test("identifies if the app doesn't use workspaces", async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

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
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  test('identifies if the app uses pnpm workspaces', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmWorkspaceFilePath = joinPath(tmpDir, pnpmWorkspaceFile)
    await writeFile(pnpmWorkspaceFilePath, '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  test('does not double-count webs defined in workspaces', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['web'],
      name: 'my_app',
      dependencies: {'empty-npm-package': '1.0.0'},
      devDependencies: {},
    })

    // When
    let app = await loadApp({directory: tmpDir, specifications})
    const web = app.webs[0]!
    // Force npm to symlink the workspace directory
    await writeFile(
      joinPath(web.directory, 'package.json'),
      JSON.stringify({name: 'web', dependencies: {'empty-npm-package': '1.0.0'}, devDependencies: {}}),
    )
    await installNodeModules({
      directory: app.directory,
      packageManager: 'npm',
    })
    app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.usesWorkspaces).toBe(true)
    expect(app.webs.length).toBe(1)
  }, 30000)

  test("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({name: 'my-extension'})

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(/Couldn't find the configuration file/)
  })

  test('throws an error if the extension configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my_extension"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app with web blocks', async () => {
    // Given
    const {webDirectory} = await writeConfig(appConfiguration)
    await moveFile(webDirectory, joinPath(tmpDir, 'we_check_everywhere'))

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.webs.length).toBe(1)
    const web = app.webs[0]!
    expect(web.configuration.roles).toEqual(['backend'])
  })

  test('throws an error if there are multiple backends', async () => {
    // Given
    const {webDirectory} = await writeConfig(appConfiguration)
    const anotherWebDirectory = joinPath(webDirectory, '..', 'another_web_dir')
    await mkdir(anotherWebDirectory)
    await writeWebConfiguration({webDirectory: anotherWebDirectory, role: 'backend'})

    // Then
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('throws an error if there are multiple frontends', async () => {
    // Given
    const {webDirectory} = await writeConfig(appConfiguration)
    await writeWebConfiguration({webDirectory, role: 'frontend'})
    const anotherWebDirectory = joinPath(webDirectory, '..', 'another_web_dir')
    await mkdir(anotherWebDirectory)
    await writeWebConfiguration({webDirectory: anotherWebDirectory, role: 'frontend'})

    // Then
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app with custom located web blocks', async () => {
    // Given
    const {webDirectory} = await writeConfig(`
    scopes = ""
    web_directories = ["must_be_here"]
    `)
    await moveFile(webDirectory, joinPath(tmpDir, 'must_be_here'))

    // When
    const app = await loadApp({directory: tmpDir, specifications})

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
    const app = await loadApp({directory: tmpDir, specifications})

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
      blockConfiguration,
      name: 'my-extension',
    })
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions[0]!.configuration.name).toBe('my_extension')
    expect(app.allExtensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.allExtensions[0]!.localIdentifier).toBe('my-extension')
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
      blockConfiguration,
      name: 'my-extension',
    })
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions[0]!.configuration.name).toBe('my_extension')
    expect(app.allExtensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.allExtensions[0]!.localIdentifier).toBe('my-extension')
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
      blockConfiguration,
      name: 'custom-extension',
      directory: customExtensionDirectory,
    })
    await writeFile(joinPath(customExtensionDirectory, 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions[0]!.configuration.name).toBe('custom_extension')
    expect(app.allExtensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_CUSTOM_EXTENSION_ID')
    expect(app.allExtensions[0]!.localIdentifier).toBe('custom_extension')
  })

  test('loads the app from a extension directory when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await loadApp({directory: blockDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
    expect(app.allExtensions[0]!.configuration.name).toBe('my_extension')
    expect(app.allExtensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
  })

  test('loads the app with several extensions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)

    let blockConfiguration = `
      name = "my_extension_1"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my_extension_1',
    })
    await writeFile(joinPath(blockPath('my_extension_1'), 'index.js'), '')

    blockConfiguration = `
      name = "my_extension_2"
      type = "product_subscription"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my_extension_2',
    })
    await writeFile(joinPath(blockPath('my_extension_2'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(2)
    const extensions = app.allExtensions.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(extensions[0]!.configuration.name).toBe('my_extension_1')
    expect(extensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_1_ID')
    expect(extensions[1]!.configuration.name).toBe('my_extension_2')
    expect(extensions[1]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_2_ID')
  })

  test('loads the app with several extensions defined in a single toml file', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "my_extension_1"
      api_version = "2022-07"
      description = "global description"

      [[extensions]]
      type = "checkout_post_purchase"
      handle = "checkout_ext"
      description = "custom description"

      [[extensions]]
      type = "flow_action"
      handle = "flow_ext"
      name = "my_extension_1_flow"
      runtime_url = "https://example.com"

      [settings]
      [[settings.fields]]
      key = "my_field"
      name = "My Field"
      description = "My Field Description"
      required = true
      type = "single_line_text_field"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my_extension_1',
    })
    await writeFile(joinPath(blockPath('my_extension_1'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(2)
    const extensions = app.allExtensions.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(extensions[0]!.configuration.name).toBe('my_extension_1')
    expect(extensions[0]!.configuration.type).toBe('checkout_post_purchase')
    expect(extensions[0]!.configuration.api_version).toBe('2022-07')
    expect(extensions[0]!.configuration.settings!.fields![0]!.key).toBe('my_field')
    expect(extensions[0]!.configuration.description).toBe('custom description')

    expect(extensions[1]!.configuration.name).toBe('my_extension_1_flow')
    expect(extensions[1]!.configuration.type).toBe('flow_action')
    expect(extensions[1]!.configuration.api_version).toBe('2022-07')
    expect(extensions[1]!.configuration.settings!.fields![0]!.key).toBe('my_field')
    expect(extensions[1]!.configuration.description).toBe('global description')
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
          blockConfiguration,
          name: `my_extension_${index}`,
        })
        const sourceAbsolutePath = joinPath(blockPath(`my_extension_${index}`), sourcePath)
        await mkdir(dirname(sourceAbsolutePath))
        await writeFile(sourceAbsolutePath, '')
      }),
    )

    // When
    await expect(loadApp({directory: tmpDir, specifications})).resolves.not.toBeUndefined()
  })

  test(`throws an error if the extension doesn't have a source file`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(loadApp({directory: blockDir, specifications})).rejects.toThrow(
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
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(() => loadApp({directory: tmpDir, specifications})).rejects.toThrowError()
  })

  test("throws an error if the configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({name: 'my-functions'})

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(/Couldn't find the configuration file/)
  })

  test('throws an error if the function configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my-function"
    `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    await expect(() => loadApp({directory: tmpDir, specifications})).rejects.toThrowError()
  })

  test('throws an error if the function has a type non included in the specs', async () => {
    // Given
    const blockConfiguration = `
    name = "my-function"
    type = "wrong_type"
    api_version = "2022-07"
    `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    await expect(() => loadApp({directory: tmpDir, specifications})).rejects.toThrowError()
  })

  test('loads the app when it has a function with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "my-function"
      type = "order_discounts"
      api_version = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })
    await mkdir(joinPath(blockPath('my-function'), 'src'))
    await writeFile(joinPath(blockPath('my-function'), 'src', 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})
    const myFunction = app.allExtensions[0]!

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
      api_version = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function-1',
    })

    blockConfiguration = `
      name = "my-function-2"
      type = "product_discounts"
      api_version = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function-2',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(2)
    const functions = app.allExtensions.sort((extA, extB) =>
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
      api_version = "2022-07"

      [build]
      command = "make build"
      path = "target/wasm32-wasi/release/my-function.wasm"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions[0]!.outputPath).toMatch(/wasm32-wasi\/release\/my-function.wasm/)
  })

  test(`defaults the function wasm path if not configured`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my-function"
      type = "order_discounts"
      api_version = "2022-07"

      [build]
      command = "make build"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions[0]!.outputPath).toMatch(/.+dist\/index.wasm$/)
  })

  test(`updates metadata after loading`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration)
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await loadApp({directory: tmpDir, specifications})

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      project_type: 'node',
      env_package_manager_workspaces: false,
      ...configAsCodeLegacyMetadata(),
    })
  })

  test(`updates metadata after loading with a flag that indicates the usage of workspaces`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await loadApp({directory: tmpDir, specifications})

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      project_type: 'node',
      env_package_manager_workspaces: true,
      ...configAsCodeLegacyMetadata(),
    })
  })

  test(`updates metadata after loading a config as code application`, async () => {
    const {webDirectory} = await writeConfig(linkedAppConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await loadApp({directory: tmpDir, specifications})

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      project_type: 'node',
      env_package_manager_workspaces: true,
      cmd_app_linked_config_used: true,
      cmd_app_linked_config_uses_cli_managed_urls: true,
      cmd_app_all_configs_any: true,
      cmd_app_all_configs_clients: JSON.stringify({'shopify.app.toml': '1234567890'}),
      cmd_app_linked_config_name: 'shopify.app.toml',
      cmd_app_linked_config_git_tracked: true,
      cmd_app_linked_config_source: 'default',
    })
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).resolves.toBeDefined()
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).resolves.toBeDefined()
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(
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
        blockConfiguration,
        name: 'my-extension',
      })
      await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

      // When
      await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(
        /authenticated_redirect_redirect_urls can not be an empty array! It may only contain one or multiple valid URLs./,
      )
    })
  })
})

describe('getAppConfigurationFileName', () => {
  test('returns legacy file name when passing undefined or empty string', async () => {
    // When/Then
    expect(getAppConfigurationFileName()).toEqual('shopify.app.toml')
    expect(getAppConfigurationFileName('')).toEqual('shopify.app.toml')
  })

  test('returns the same value when passing full file name', async () => {
    // When/Then
    expect(getAppConfigurationFileName('shopify.app.staging.toml')).toEqual('shopify.app.staging.toml')
    expect(getAppConfigurationFileName('shopify.app.local.toml')).toEqual('shopify.app.local.toml')
  })

  test('builds file name when passing config name', async () => {
    // When/Then
    expect(getAppConfigurationFileName('staging')).toEqual('shopify.app.staging.toml')
    expect(getAppConfigurationFileName('local')).toEqual('shopify.app.local.toml')
  })

  test('supports names with dashes', async () => {
    // When / Then
    expect(getAppConfigurationFileName('cool-whip')).toEqual('shopify.app.cool-whip.toml')
  })

  test('slugifies names', async () => {
    // When / Then
    expect(getAppConfigurationFileName('Cool Whip')).toEqual('shopify.app.cool-whip.toml')
  })
})

describe('getAppConfigurationShorthand', () => {
  test('returns undefined when the default name is used', async () => {
    // When/Then
    expect(getAppConfigurationShorthand('shopify.app.toml')).toBeUndefined()
    expect(getAppConfigurationShorthand('/very/long/path/shopify.app.toml')).toBeUndefined()
  })

  test('returns shorthand when it is present', async () => {
    // When/Then
    expect(getAppConfigurationShorthand('shopify.app.foobar.toml')).toEqual('foobar')
    expect(getAppConfigurationShorthand('/very/long/path/shopify.app.foobar.toml')).toEqual('foobar')
  })

  test('supports names with dashes', async () => {
    // When / Then
    expect(getAppConfigurationShorthand('shopify.app.cool-whip.toml')).toEqual('cool-whip')
  })
})

describe('loadDotEnv', () => {
  test('it returns undefined if the env is missing', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // When
      const got = await loadDotEnv(tmp, joinPath(tmp, 'shopify.app.toml'))

      // Then
      expect(got).toBeUndefined()
    })
  })

  test('it loads from the default env file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      await writeFile(joinPath(tmp, '.env'), 'FOO="bar"')

      // When
      const got = await loadDotEnv(tmp, joinPath(tmp, 'shopify.app.toml'))

      // Then
      expect(got).toBeDefined()
      expect(got!.variables.FOO).toEqual('bar')
    })
  })

  test('it loads from the config specific env file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      await writeFile(joinPath(tmp, '.env.staging'), 'FOO="bar"')

      // When
      const got = await loadDotEnv(tmp, joinPath(tmp, 'shopify.app.staging.toml'))

      // Then
      expect(got).toBeDefined()
      expect(got!.variables.FOO).toEqual('bar')
    })
  })
})
