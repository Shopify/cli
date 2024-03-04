import {
  getAppConfigurationShorthand,
  getAppConfigurationFileName,
  loadApp,
  loadDotEnv,
  parseConfigurationObject,
} from './loader.js'
import {LegacyAppSchema, WebConfigurationSchema} from './app.js'
import {DEFAULT_CONFIG, buildVersionedAppSchema, getWebhookConfig} from './app.test-data.js'
import {configurationFileNames, blocks} from '../../constants.js'
import metadata from '../../metadata.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {getCachedAppInfo} from '../../services/local-storage.js'
import use from '../../services/app/config/use.js'
import {WebhookSchema} from '../extensions/specifications/app_config_webhook.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {describe, expect, beforeEach, afterEach, beforeAll, test, vi} from 'vitest'
import {
  installNodeModules,
  yarnLockfile,
  pnpmLockfile,
  PackageJson,
  pnpmWorkspaceFile,
} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, moveFile, mkdir, mkTmpDir, rmdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, cwd, normalizePath} from '@shopify/cli-kit/node/path'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {outputContent} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'path'

vi.mock('../../services/local-storage.js')
vi.mock('../../services/app/config/use.js')

describe('load', () => {
  let specifications: ExtensionSpecification[] = []

  let tmpDir: string
  const appConfiguration = `
scopes = "read_products"
`
  const linkedAppConfiguration = `
name = "for-testing"
client_id = "1234567890"
application_url = "https://example.com/lala"
embedded = true

[webhooks]
api_version = "2023-07"

[auth]
redirect_urls = [ "https://example.com/api/auth" ]

[build]
automatically_update_urls_on_dev = true
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

  const writeConfig = async (
    appConfiguration: string,
    packageJson?: PackageJson,
  ): Promise<{webDirectory: string; appConfigurationPath: string}> => {
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

  test('throws an error when the configuration file has invalid nested elements and the schema is generated from the specifications', async () => {
    // Given
    const appConfiguration = `
name = "for-testing"
client_id = "1234567890"
application_url = "https://example.com/lala"
embedded = true

[access]
wrong = "property"
`
    await writeConfig(appConfiguration)

    // When/Then
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app when the configuration file has invalid nested elements but the schema isnt generated from the specifications', async () => {
    // Given
    const appConfiguration = `
name = "for-testing"
client_id = "1234567890"
application_url = "https://example.com/lala"
embedded = true

[access]
wrong = "property"
`
    await writeConfig(appConfiguration)

    // When
    const app = await loadApp({directory: tmpDir, specifications: []})

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
    await writeConfig(appConfiguration, {
      workspaces: ['web'],
      name: 'my_app',
      dependencies: {'empty-npm-package': '1.0.0'},
      devDependencies: {},
    })

    const blockConfiguration = `
      wrong = "my_extension"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(/Fix a schema error in/)
  })

  test('throws an error if the extension type is invalid', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['web'],
      name: 'my_app',
      dependencies: {'empty-npm-package': '1.0.0'},
      devDependencies: {},
    })

    const blockConfiguration = `
      name = "extension"
      type = "invalid_type"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })
    await writeFile(joinPath(blockPath('my-extension'), 'index.js'), '')

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(/Invalid extension type "invalid_type"/)
  })

  test('throws if 2 or more extensions have the same handle', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      api_version = "2022-07"

      [[extensions]]
      type = "checkout_post_purchase"
      name = "my_extension_1"
      handle = "handle-1"
      description = "custom description"

      [[extensions]]
      type = "flow_action"
      handle = "handle-1"
      name = "my_extension_1_flow"
      description = "custom description"
      runtime_url = "https://example.com"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my_extension_1',
    })
    await writeFile(joinPath(blockPath('my_extension_1'), 'index.js'), '')

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(/Duplicated handle/)
  })

  test('throws an error if the extension configuration is unified and doesnt include a handle', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['web'],
      name: 'my_app',
      dependencies: {'empty-npm-package': '1.0.0'},
      devDependencies: {},
    })

    const blockConfiguration = `
      name = "my_extension-global"

      [[extensions]]
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(
      /Missing handle for extension "my_extension"/,
    )
  })

  test('throws an error if the extension configuration is missing both extensions and type', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['web'],
      name: 'my_app',
      dependencies: {'empty-npm-package': '1.0.0'},
      devDependencies: {},
    })

    const blockConfiguration = `
      name = "my_extension-global"
      handle = "handle"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow(/Invalid extension type/)
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
    expect(app.allExtensions[0]!.localIdentifier).toBe('custom-extension')
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
      api_version = "2022-07"
      description = "global description"

      [[extensions]]
      type = "checkout_post_purchase"
      name = "my_extension_1"
      handle = "checkout-ext"
      description = "custom description"

      [[extensions]]
      type = "flow_action"
      handle = "flow-ext"
      name = "my_extension_1_flow"
      runtime_url = "https://example.com"

      [extensions.settings]
      [[extensions.settings.fields]]
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

  test('loads the app with a Flow trigger extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      [[extensions]]
      name = "Auction bid placed"
      description = "An auction bid has been placed"
      type = "flow_trigger"
      handle = "handle1"

      [settings]

        [[settings.fields]]
        type = "customer_reference"

        [[settings.fields]]
        type = "single_line_text_field"
        key = "your field key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-flow-trigger',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        description: 'An auction bid has been placed',
        name: 'Auction bid placed',
        type: 'flow_trigger',
        handle: 'handle1',
        settings: {
          fields: [
            {
              type: 'customer_reference',
            },
            {
              type: 'single_line_text_field',
              key: 'your field key',
            },
          ],
        },
      })
    }
  })

  test('loads the app with a Flow action extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      [[extensions]]
      name = "Place a bid"
      description = "Place a bid on an auction"
      type = "flow_action"
      handle = "handle2"
      runtime_url = "https://url.com/api/execute"
      schema = "./schema_patch.graphql"
      return_type_ref = "Auction"
      validation_url = "https://url.com/api/validate"
      config_page_url = "https://url.com/config"
      config_page_preview_url = "https://url.com/config/preview"

      [settings]

        [[settings.fields]]
        type = "customer_reference"
        required = true

        [[settings.fields]]
        type = "single_line_text_field"
        key = "your_field_key"
        name = "Display name"
        description = "A description of my field"
        required = true
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-flow-action',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        description: 'Place a bid on an auction',
        name: 'Place a bid',
        type: 'flow_action',
        handle: 'handle2',
        runtime_url: 'https://url.com/api/execute',
        schema: './schema_patch.graphql',
        return_type_ref: 'Auction',
        validation_url: 'https://url.com/api/validate',
        config_page_url: 'https://url.com/config',
        config_page_preview_url: 'https://url.com/config/preview',
        settings: {
          fields: [
            {
              type: 'customer_reference',
              required: true,
            },
            {
              type: 'single_line_text_field',
              key: 'your_field_key',
              name: 'Display name',
              description: 'A description of my field',
              required: true,
            },
          ],
        },
      })
    }
  })

  test('loads the app with a Function extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "My function"
      type = "product_discounts"
      api_version = "2023-01"

      [build]
      command = "cargo wasi build --release"
      path = "target/wasm32-wasi/release/my-function.wasm"
      watch = [ "src/**/*.rs" ]

      [ui]
      enable_create = false

      [ui.paths]
      create = "/"
      details = "/"

      [input.variables]
      namespace = "my-app"
      key = "my-input-variables"

      [[targeting]]
      target = "checkout.fetch"
      input_query = "./input_query.graphql"
      export = "fetch"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        name: 'My function',
        type: 'product_discounts',
        api_version: '2023-01',
        build: {
          command: 'cargo wasi build --release',
          path: 'target/wasm32-wasi/release/my-function.wasm',
          watch: ['src/**/*.rs'],
        },
        ui: {
          enable_create: false,
          paths: {
            create: '/',
            details: '/',
          },
        },
        input: {
          variables: {
            namespace: 'my-app',
            key: 'my-input-variables',
          },
        },
        targeting: [
          {
            target: 'checkout.fetch',
            input_query: './input_query.graphql',
            export: 'fetch',
          },
        ],
      })
    }
  })

  test('loads the app with a Function extension that has a full valid configuration with unified config', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      api_version = "2023-01"

      [[extensions]]
      name = "My function"
      handle = "my-function"
      type = "product_discounts"

      [extensions.build]
      command = "cargo wasi build --release"
      path = "target/wasm32-wasi/release/my-function.wasm"
      watch = [ "src/**/*.rs" ]

      [extensions.ui]
      enable_create = false

      [extensions.ui.paths]
      create = "/"
      details = "/"

      [extensions.input.variables]
      namespace = "my-app"
      key = "my-input-variables"

      [[extensions.targeting]]
      target = "checkout.fetch"
      input_query = "./input_query.graphql"
      export = "fetch"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        name: 'My function',
        handle: 'my-function',
        type: 'product_discounts',
        api_version: '2023-01',
        build: {
          command: 'cargo wasi build --release',
          path: 'target/wasm32-wasi/release/my-function.wasm',
          watch: ['src/**/*.rs'],
        },
        ui: {
          enable_create: false,
          paths: {
            create: '/',
            details: '/',
          },
        },
        input: {
          variables: {
            namespace: 'my-app',
            key: 'my-input-variables',
          },
        },
        targeting: [
          {
            target: 'checkout.fetch',
            input_query: './input_query.graphql',
            export: 'fetch',
          },
        ],
      })
    }
  })

  test('loads the app with an Admin Action extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      api_version = "unstable"
      [[extensions]]
      name = "my-admin-action"
      handle = "admin-action-handle"
      type = "ui_extension"
      [[extensions.targeting]]
      module = "./src/ActionExtension.js"
      target = "admin.product-details.action.render"
      [[extensions.metafields]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-admin-action',
    })

    // Create a temporary ActionExtension.js file
    const extensionDirectory = joinPath(tmpDir, 'extensions', 'my-admin-action', 'src')
    await mkdir(extensionDirectory)

    const tempFilePath = joinPath(extensionDirectory, 'ActionExtension.js')
    await writeFile(tempFilePath, '/* ActionExtension.js content */')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        api_version: 'unstable',
        name: 'my-admin-action',
        handle: 'admin-action-handle',
        type: 'ui_extension',
        metafields: [
          {
            namespace: 'my-namespace',
            key: 'my-key',
          },
        ],
        extension_points: [
          {
            metafields: [
              {
                namespace: 'my-namespace',
                key: 'my-key',
              },
            ],
            module: './src/ActionExtension.js',
            target: 'admin.product-details.action.render',
          },
        ],
        targeting: [
          {
            module: './src/ActionExtension.js',
            target: 'admin.product-details.action.render',
          },
        ],
      })
    }
  })

  test('loads the app with a UI extension that has a full valid unified configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      api_version = "2023-07"

      [[extensions]]
      name = "My checkout extension"
      handle = "checkout-ui"
      type = "ui_extension"

        [[extensions.metafields]]
        namespace = "my-namespace"
        key = "my-key"
        [[extensions.metafields]]
        namespace = "my-namespace"
        key = "my-other-key"

        [extensions.capabilities]
        network_access = true
        block_progress = true
        api_access = true

        [extensions.capabilities.collect_buyer_consent]
        customer_privacy = false
        sms_marketing = true

        [extensions.settings]
          [[extensions.settings.fields]]
          key = "field_key"
          type = "boolean"
          name = "field-name"
          [[extensions.settings.fields]]
          key = "field_key_2"
          type = "number_integer"
          name = "field-name-2"
          validations = [ { name = "min", value = "5" }, { name = "max", value = "20" } ]

        [[extensions.targeting]]
        target = "purchase.checkout.block.render"
        module = "./CheckoutDynamicRender.jsx"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'checkout-ui',
    })

    await writeFile(
      joinPath(blockPath('checkout-ui'), 'CheckoutDynamicRender.jsx'),
      `
    import { extension, Banner } from "@shopify/ui-extensions/checkout";

    export default extension("purchase.checkout.block.render", (root, { extension: { target } , i18n }) => {
      root.appendChild(
        root.createComponent(
          Banner,
          { title: "{{ name }}" },
          i18n.translate('welcome', {target})
        )
      );
    });
    `,
    )

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        api_version: '2023-07',
        name: 'My checkout extension',
        handle: 'checkout-ui',
        type: 'ui_extension',
        metafields: [
          {
            namespace: 'my-namespace',
            key: 'my-key',
          },
          {
            namespace: 'my-namespace',
            key: 'my-other-key',
          },
        ],
        capabilities: {
          network_access: true,
          block_progress: true,
          api_access: true,
          collect_buyer_consent: {
            customer_privacy: false,
            sms_marketing: true,
          },
        },
        settings: {
          fields: [
            {
              key: 'field_key',
              type: 'boolean',
              name: 'field-name',
            },
            {
              key: 'field_key_2',
              type: 'number_integer',
              name: 'field-name-2',
              validations: [
                {
                  name: 'min',
                  value: '5',
                },
                {
                  name: 'max',
                  value: '20',
                },
              ],
            },
          ],
        },
        extension_points: [
          {
            metafields: [
              {
                key: 'my-key',
                namespace: 'my-namespace',
              },
              {
                key: 'my-other-key',
                namespace: 'my-namespace',
              },
            ],
            module: './CheckoutDynamicRender.jsx',
            target: 'purchase.checkout.block.render',
          },
        ],
        targeting: [
          {
            target: 'purchase.checkout.block.render',
            module: './CheckoutDynamicRender.jsx',
          },
        ],
      })
    }
  })

  test('loads the app with a Checkout Post Purchase extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "checkout_post_purchase"
      name = "my-checkout-post-purchase"

      [[metafields]]
      namespace = "my-namespace"
      key = "my-key"

      [[metafields]]
      namespace = "my-namespace"
      key = "my-key-2"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-checkout-post-purchase',
    })

    await writeFile(joinPath(blockPath('my-checkout-post-purchase'), 'index.js'), '/** content **/')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'checkout_post_purchase',
        name: 'my-checkout-post-purchase',
        metafields: [
          {
            namespace: 'my-namespace',
            key: 'my-key',
          },
          {
            namespace: 'my-namespace',
            key: 'my-key-2',
          },
        ],
      })
    }
  })

  test('loads the app with a POS UI extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "pos_ui_extension"
      name = "my-pos-ui-extension"
      description = "my-pos-ui-extension-description"

      extension_points = [
        'pos.home.tile.render',
        'pos.home.modal.render'
      ]
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-pos-ui-extension',
    })

    const checkoutUiDirectory = joinPath(tmpDir, 'extensions', 'my-pos-ui-extension', 'src')
    await mkdir(checkoutUiDirectory)

    const tempFilePath = joinPath(checkoutUiDirectory, 'index.js')
    await writeFile(tempFilePath, `/** content **/`)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'pos_ui_extension',
        name: 'my-pos-ui-extension',
        description: 'my-pos-ui-extension-description',
        extension_points: ['pos.home.tile.render', 'pos.home.modal.render'],
      })
    }
  })

  test('loads the app with a Tax Calculation extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "tax_calculation"
      name = "my-tax-calculation"

      production_api_base_url = "https://prod.example.com"
      benchmark_api_base_url = "https://benchmark.example.com"
      calculate_taxes_api_endpoint = "/calculate-taxes"

      [input.metafield_identifiers]
      namespace = "taxy-tax"
      key = "metafield-config"

      [[metafields]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-tax-calculation',
    })

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'tax_calculation',
        name: 'my-tax-calculation',
        production_api_base_url: 'https://prod.example.com',
        benchmark_api_base_url: 'https://benchmark.example.com',
        calculate_taxes_api_endpoint: '/calculate-taxes',
        metafields: [
          {
            namespace: 'my-namespace',
            key: 'my-key',
          },
        ],
        input: {
          metafield_identifiers: {
            namespace: 'taxy-tax',
            key: 'metafield-config',
          },
        },
      })
    }
  })

  test('loads the app with a Web Pixel extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "web_pixel_extension"
      name = "pixel"
      runtime_context = "strict"

      [settings]
      type = "object"

      [settings.fields.first]
      name = "first"
      description = "description"
      type = "single_line_text_field"
      validations = [{ choices = ["a", "b", "c"] }]

      [settings.fields.second]
      name = "second"
      description = "description"
      type = "single_line_text_field"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'pixel',
    })
    await writeFile(joinPath(blockPath('pixel'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'web_pixel_extension',
        name: 'pixel',
        runtime_context: 'strict',
        settings: {
          type: 'object',
          fields: {
            first: {
              description: 'description',
              name: 'first',
              type: 'single_line_text_field',
              validations: [
                {
                  choices: ['a', 'b', 'c'],
                },
              ],
            },
            second: {
              description: 'description',
              name: 'second',
              type: 'single_line_text_field',
            },
          },
        },
      })
    }
  })

  test('loads the app with a Web Pixel extension that has a full valid configuration with privacy settings', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "web_pixel_extension"
      name = "pixel"
      runtime_context = "strict"

      [customer_privacy]
      analytics = false
      preferences = false
      marketing = true
      sale_of_data = "enabled"

      [settings]
      type = "object"

      [settings.fields.first]
      name = "first"
      description = "description"
      type = "single_line_text_field"
      validations = [{ choices = ["a", "b", "c"] }]

      [settings.fields.second]
      name = "second"
      description = "description"
      type = "single_line_text_field"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'pixel',
    })
    await writeFile(joinPath(blockPath('pixel'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'web_pixel_extension',
        name: 'pixel',
        runtime_context: 'strict',
        customer_privacy: {
          analytics: false,
          marketing: true,
          preferences: false,
          sale_of_data: 'enabled',
        },
        settings: {
          type: 'object',
          fields: {
            first: {
              description: 'description',
              name: 'first',
              type: 'single_line_text_field',
              validations: [
                {
                  choices: ['a', 'b', 'c'],
                },
              ],
            },
            second: {
              description: 'description',
              name: 'second',
              type: 'single_line_text_field',
            },
          },
        },
      })
    }
  })

  test('loads the app with a Legacy Checkout UI extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "checkout_ui_extension"
      name = "my-checkout-extension"

      extension_points = [
        'Checkout::Dynamic::Render'
      ]

      [[metafields]]
      namespace = "my-namespace"
      key = "my-key"

      [[metafields]]
      namespace = "my-namespace"
      key = "my-other-key"

      [capabilities]
      network_access = true
      block_progress = true
      api_access = true

      [capabilities.collect_buyer_consent]
      customer_privacy = true
      sms_marketing = true

      [settings]
        [[settings.fields]]
        key = "field_key"
        type = "boolean"
        name = "field-name"
        [[settings.fields]]
        key = "field_key_2"
        type = "number_integer"
        name = "field-name-2"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-checkout-extension',
    })

    await writeFile(joinPath(blockPath('my-checkout-extension'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'checkout_ui_extension',
        name: 'my-checkout-extension',
        extension_points: ['Checkout::Dynamic::Render'],
        capabilities: {
          api_access: true,
          block_progress: true,
          network_access: true,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: true,
          },
        },
        settings: {
          fields: [
            {
              key: 'field_key',
              name: 'field-name',
              type: 'boolean',
            },
            {
              key: 'field_key_2',
              name: 'field-name-2',
              type: 'number_integer',
            },
          ],
        },
        metafields: [
          {
            key: 'my-key',
            namespace: 'my-namespace',
          },
          {
            key: 'my-other-key',
            namespace: 'my-namespace',
          },
        ],
      })
    }
  })

  test('loads the app with a Product Subscription extension that has a full valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      type = "product_subscription"
      name = "my-product-subscription"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-product-subscription',
    })

    await writeFile(joinPath(blockPath('my-product-subscription'), 'index.js'), '')

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(1)
    const extension = app.allExtensions[0]
    expect(extension).not.toBeUndefined()
    if (extension) {
      expect(extension.configuration).toMatchObject({
        type: 'product_subscription',
        name: 'my-product-subscription',
      })
    }
  })

  test('loads the app with a Pos configuration app access extension configured inside the toml file', async () => {
    // Given
    const linkedAppConfigurationWithPosConfiguration = `
    name = "for-testing"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [build]
    include_config_on_deploy = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [pos]
    embedded = true
    `
    await writeConfig(linkedAppConfigurationWithPosConfiguration)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.allExtensions).toHaveLength(5)
    const extensionsConfig = app.allExtensions.map((ext) => ext.configuration)
    expect(extensionsConfig).toEqual([
      expect.objectContaining({
        name: 'for-testing',
      }),
      expect.objectContaining({
        auth: {
          redirect_urls: ['https://example.com/api/auth'],
        },
      }),
      expect.objectContaining({
        webhooks: {
          api_version: '2023-07',
        },
      }),
      expect.objectContaining({
        pos: {
          embedded: true,
        },
      }),
      expect.objectContaining({
        application_url: 'https://example.com/lala',
        embedded: true,
      }),
    ])
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

  test('throws error if config file is passed in but does not exist', async () => {
    // Given
    await writeConfig(linkedAppConfiguration)
    vi.mocked(getCachedAppInfo).mockReturnValue({directory: tmpDir, configFile: 'shopify.app.non-existent.toml'})
    vi.mocked(use).mockResolvedValue('shopify.app.toml')

    // When
    const result = loadApp({directory: tmpDir, specifications, configName: 'non-existent'})

    // Then
    await expect(result).rejects.toThrow(`Couldn't find shopify.app.non-existent.toml in ${tmpDir}.`)
    expect(use).not.toHaveBeenCalled()
  })

  test('loads the app when access.admin.direct_api_mode = "online"', async () => {
    // Given
    const config = `
    name = "my_app"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [access.admin]
    direct_api_mode = "online"
    `
    await writeConfig(config)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
  })

  test('loads the app when access.admin.direct_api_mode = "offline"', async () => {
    // Given
    const config = `
    name = "my_app"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [access.admin]
    direct_api_mode = "offline"
    `
    await writeConfig(config)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
  })

  test('throws an error when access.admin.direct_api_mode is invalid', async () => {
    // Given
    const config = `
    name = "my_app"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [access.admin]
    direct_api_mode = "foo"
    `
    await writeConfig(config)

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  test('loads the app when access.admin.embedded_app_direct_api_access = true', async () => {
    // Given
    const config = `
    name = "my_app"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [access.admin]
    embedded_app_direct_api_access = true
    `
    await writeConfig(config)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
  })

  test('loads the app when access.admin.embedded_app_direct_api_access = false', async () => {
    // Given
    const config = `
    name = "my_app"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [access.admin]
    embedded_app_direct_api_access = false
    `
    await writeConfig(config)

    // When
    const app = await loadApp({directory: tmpDir, specifications})

    // Then
    expect(app.name).toBe('my_app')
  })

  test('throws an error when access.admin.embedded_app_direct_api_access is invalid', async () => {
    // Given
    const config = `
    name = "my_app"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [webhooks]
    api_version = "2023-07"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]

    [access.admin]
    embedded_app_direct_api_access = "foo"
    `
    await writeConfig(config)

    // When
    await expect(loadApp({directory: tmpDir, specifications})).rejects.toThrow()
  })

  const runningOnWindows = platformAndArch().platform === 'windows'

  test.skipIf(runningOnWindows)(
    'prompts to select new config if current config file is set but does not exist',
    async () => {
      // Given
      await writeConfig(linkedAppConfiguration)
      vi.mocked(getCachedAppInfo).mockReturnValue({directory: tmpDir, configFile: 'shopify.app.non-existent.toml'})
      vi.mocked(use).mockResolvedValue('shopify.app.toml')

      // When
      await loadApp({directory: tmpDir, specifications})

      // Then
      expect(use).toHaveBeenCalledWith({
        directory: normalizePath(resolve(tmpDir)),
        shouldRenderSuccess: false,
        warningContent: {
          headline: "Couldn't find shopify.app.non-existent.toml",
          body: [
            "If you have multiple config files, select a new one. If you only have one config file, it's been selected as your default.",
          ],
        },
      })
    },
  )

  test.skipIf(runningOnWindows)(`updates metadata after loading a config as code application`, async () => {
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
      cmd_app_linked_config_source: 'cached',
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

describe('parseConfigurationObject', () => {
  test('throws an error if fields are missing in a current schema TOML file', async () => {
    const configurationObject = {
      ...DEFAULT_CONFIG,
      embedded: undefined,
    }

    const errorObject = [
      {
        code: 'invalid_type',
        expected: 'object',
        received: 'undefined',
        path: ['auth'],
        message: 'Required',
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        received: 'undefined',
        path: ['embedded'],
        message: 'Required',
      },
    ]
    const expectedFormatted = outputContent`Fix a schema error in tmp:\n${JSON.stringify(errorObject, null, 2)}`
    const abortOrReport = vi.fn()

    const {schema} = await buildVersionedAppSchema()
    const {path, ...toParse} = configurationObject
    await parseConfigurationObject(schema, 'tmp', toParse, abortOrReport)

    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', errorObject)
  })

  test('throws an error if fields are missing in a legacy schema TOML file', async () => {
    const configurationObject = {
      scopes: [],
    }

    const errorObject = [
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'array',
        path: ['scopes'],
        message: 'Expected string, received array',
      },
    ]
    const expectedFormatted = outputContent`Fix a schema error in tmp:\n${JSON.stringify(errorObject, null, 2)}`
    const abortOrReport = vi.fn()
    await parseConfigurationObject(LegacyAppSchema, 'tmp', configurationObject, abortOrReport)

    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', errorObject)
  })

  test('throws an error if fields are missing in a frontend config web TOML file', async () => {
    const configurationObject = {
      type: 11,
      commands: {dev: ''},
      roles: 1,
    }

    const errorObject = [
      {
        code: 'invalid_union',
        unionErrors: [
          {
            issues: [
              {
                code: 'invalid_type',
                expected: 'array',
                received: 'number',
                path: ['roles'],
                message: 'Expected array, received number',
              },
            ],
            name: 'ZodError',
          },
          {
            issues: [
              {
                expected: "'frontend' | 'backend' | 'background'",
                received: 'number',
                code: 'invalid_type',
                path: ['type'],
                message: "Expected 'frontend' | 'backend' | 'background', received number",
              },
            ],
            name: 'ZodError',
          },
        ],
        path: [],
        message: 'Invalid input',
      },
    ]
    const expectedFormatted = outputContent`Fix a schema error in tmp:\n${JSON.stringify(errorObject, null, 2)}`
    const abortOrReport = vi.fn()
    await parseConfigurationObject(WebConfigurationSchema, 'tmp', configurationObject, abortOrReport)

    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', expect.anything())
  })
})

describe('WebhooksSchema', () => {
  test('throws an error if uri is not an https uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          uri: 'http://example.com',
          topics: ['products/create'],
        },
      ],
    }
    const errorObj = {
      validation: 'regex' as zod.ZodInvalidStringIssue['validation'],
      code: zod.ZodIssueCode.invalid_string,
      message: 'Invalid',
      path: ['webhooks', 'subscriptions', 0, 'uri'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('removes trailing slashes on uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [{uri: 'https://example.com/', topics: ['products/create']}],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    webhookConfig.subscriptions![0]!.uri = 'https://example.com'
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('throws an error if uri is not a valid https URL, pubsub URI, or Eventbridge ARN', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [{uri: 'my::URI-thing::Shopify::123', topics: ['products/create']}],
    }
    const errorObj = {
      validation: 'regex' as zod.ZodInvalidStringIssue['validation'],
      code: zod.ZodIssueCode.invalid_string,
      message: 'Invalid',
      path: ['webhooks', 'subscriptions', 0, 'uri'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('accepts an https uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [{uri: 'https://example.com', topics: ['products/create']}],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('accepts a pub sub uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [{uri: 'pubsub://my-project-123:my-topic', topics: ['products/create']}],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('accepts an ARN uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          topics: ['products/create'],
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('accepts combination of uris', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          topics: ['products/create', 'products/update'],
        },
        {
          uri: 'https://example.com',
          topics: ['products/create', 'products/update'],
        },
        {
          uri: 'pubsub://my-project-123:my-topic',
          topics: ['products/create', 'products/update'],
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('throws an error if we have duplicate subscriptions in same topics array', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {uri: 'https://example.com', topics: ['products/create', 'products/create']},
        {uri: 'https://example.com', topics: ['products/create']},
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 0, 'topics', 1, 'products/create'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('throws an error if we have duplicate subscriptions in different topics array', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {uri: 'https://example.com', topics: ['products/create', 'products/update']},
        {uri: 'https://example.com', topics: ['products/create']},
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 1, 'topics', 0, 'products/create'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('allows unique topics in both same topic array and different subscriptions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {uri: 'https://example.com', topics: ['products/create', 'products/update']},
        {uri: 'https://example.com2', topics: ['products/create', 'products/update']},
        {uri: 'https://example.com', topics: ['products/delete']},
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('removes trailing forward slash', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'https://example.com/',
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    webhookConfig.subscriptions![0]!.uri = 'https://example.com'
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('throws an error if uri is not an https uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'http://example.com',
        },
      ],
    }
    const errorObj = {
      validation: 'regex' as zod.ZodInvalidStringIssue['validation'],
      code: zod.ZodIssueCode.invalid_string,
      message: 'Invalid',
      path: ['webhooks', 'subscriptions', 0, 'uri'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('accepts a pub sub config with both project and topic', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'pubsub://my-project-123:my-topic',
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('throws an error if we have duplicate https subscriptions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'https://example.com',
        },
        {
          topics: ['products/create'],
          uri: 'https://example.com',
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 1, 'topics', 0, 'products/create'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('throws an error if we have duplicate pub sub subscriptions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'pubsub://my-project-123:my-topic',
        },
        {
          topics: ['products/create'],
          uri: 'pubsub://my-project-123:my-topic',
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 1, 'topics', 0, 'products/create'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('throws an error if we have duplicate arn subscriptions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/123/my_webhook_path',
        },
        {
          topics: ['products/create'],
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/123/my_webhook_path',
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 1, 'topics', 0, 'products/create'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('does not allow identical topic and uri and sub_topic in different subscriptions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_one',
        },
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_one',
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 1, 'topics', 0, 'metaobjects/create'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('allows identical topic and uri if sub_topic is different', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_one',
        },
        {
          topics: ['products/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_two',
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('does not allow identical compliance_topics and uri', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_one',
          compliance_topics: ['shop/redact'],
        },
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_two',
          compliance_topics: ['shop/redact'],
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate privacy compliance subscriptions with the exact same `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 1, 'compliance_topics', 0, 'shop/redact'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('does not allow identical compliance_topics in same subscription (will get by zod enum validation)', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_one',
          compliance_topics: ['shop/redact', 'shop/redact'],
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have duplicate privacy compliance subscriptions with the exact same `uri`',
      fatal: true,
      path: ['webhooks', 'subscriptions', 0, 'compliance_topics', 1, 'shop/redact'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp', [errorObj])
  })

  test('allows same compliance_topics if uri is different', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['metaobjects/create'],
          uri: 'https://example.com',
          sub_topic: 'type:metaobject_one',
          compliance_topics: ['shop/redact'],
        },
        {
          topics: ['products/create'],
          uri: 'https://example-two.com',
          sub_topic: 'type:metaobject_two',
          compliance_topics: ['shop/redact'],
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('allows same compliance_topics across https, pub sub and arn with multiple topics', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'https://example.com/all_webhooks',
          compliance_topics: ['shop/redact', 'customers/data_request', 'customers/redact'],
        },
        {
          topics: ['products/create'],
          uri: 'pubsub://my-project-123:my-topic',
          compliance_topics: ['customers/data_request', 'customers/redact'],
        },
        {
          topics: ['products/create'],
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/123/compliance',
          compliance_topics: ['shop/redact', 'customers/redact'],
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  async function setupParsing(errorObj: zod.ZodIssue | {}, webhookConfigOverrides: WebhooksConfig) {
    const err = Array.isArray(errorObj) ? errorObj : [errorObj]
    const expectedFormatted = outputContent`Fix a schema error in tmp:\n${JSON.stringify(err, null, 2)}`
    const abortOrReport = vi.fn()

    const {path, ...toParse} = getWebhookConfig(webhookConfigOverrides)
    const parsedConfiguration = await parseConfigurationObject(WebhookSchema, 'tmp', toParse, abortOrReport)
    return {abortOrReport, expectedFormatted, parsedConfiguration}
  }
})
