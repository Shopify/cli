import {
  getAppConfigurationShorthand,
  getAppConfigurationFileName,
  loadApp,
  loadOpaqueApp,
  loadDotEnv,
  parseConfigurationObject,
  checkFolderIsValidApp,
  AppLoaderMode,
  getAppConfigurationState,
  loadConfigForAppCreation,
  reloadApp,
  loadHiddenConfig,
} from './loader.js'
import {parseHumanReadableError} from './error-parsing.js'
import {App, AppInterface, AppLinkedInterface, AppSchema, WebConfigurationSchema} from './app.js'
import {DEFAULT_CONFIG, buildVersionedAppSchema, getWebhookConfig} from './app.test-data.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {configurationFileNames, blocks} from '../../constants.js'
import metadata from '../../metadata.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {getCachedAppInfo} from '../../services/local-storage.js'
import use from '../../services/app/config/use.js'
import {WebhooksSchema} from '../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {Flag} from '../../utilities/developer-platform-client.js'
import {describe, expect, beforeEach, afterEach, beforeAll, test, vi} from 'vitest'
import {
  installNodeModules,
  yarnLockfile,
  pnpmLockfile,
  PackageJson,
  pnpmWorkspaceFile,
} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, moveFile, mkdir, mkTmpDir, rmdir, writeFile, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, cwd, normalizePath} from '@shopify/cli-kit/node/path'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'
import colors from '@shopify/cli-kit/node/colors'
import {showMultipleCLIWarningIfNeeded} from '@shopify/cli-kit/node/multiple-installation-warning'
import {AbortError} from '@shopify/cli-kit/node/error'
import {captureOutput} from '@shopify/cli-kit/node/system'

vi.mock('../../services/local-storage.js')
// Mock captureOutput to prevent executing `npm prefix` inside getPackageManager
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../../services/app/config/use.js')
vi.mock('@shopify/cli-kit/node/is-global')
vi.mock('@shopify/cli-kit/node/node-package-manager', async () => ({
  ...((await vi.importActual('@shopify/cli-kit/node/node-package-manager')) as any),
  localCLIVersion: vi.fn(),
  globalCLIVersion: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/version')
vi.mock('@shopify/cli-kit/node/multiple-installation-warning')

describe('load', () => {
  let specifications: ExtensionSpecification[] = []

  let tmpDir: string

  function loadTestingApp(extras?: {remoteFlags?: Flag[]; mode?: AppLoaderMode}) {
    return loadApp({directory: tmpDir, specifications, userProvidedConfigName: undefined, ...extras})
  }

  // Helper to get only real extensions (not configuration extensions)
  function getRealExtensions(app: AppInterface) {
    return app.allExtensions.filter((ext) => ext.specification.experience !== 'configuration')
  }

  /**
   * Builds a TOML app configuration string with sensible defaults.
   * Use this to avoid repeating similar configurations across tests.
   *
   * By default, includes [webhooks] and [auth] sections. Set webhooksApiVersion or redirectUrls
   * to null to omit those sections when testing configurations without them.
   */
  interface AppConfigOptions {
    name?: string
    handle?: string
    clientId?: string
    applicationUrl?: string
    embedded?: boolean
    webhooksApiVersion?: string | null
    redirectUrls?: string[] | null
    build?: {[key: string]: boolean | string}
    access?: {[section: string]: {[key: string]: string | boolean}}
    webDirectories?: string[]
    extra?: string
  }

  const buildAppConfiguration = (options: AppConfigOptions = {}): string => {
    const {
      name = 'my_app',
      handle,
      clientId = 'test-client-id',
      applicationUrl = 'https://example.com',
      embedded = true,
      webhooksApiVersion = '2024-01',
      redirectUrls = ['https://example.com/callback'],
      build,
      access,
      webDirectories,
      extra,
    } = options

    const lines: string[] = []

    lines.push(`name = "${name}"`)
    if (handle) lines.push(`handle = "${handle}"`)
    lines.push(`client_id = "${clientId}"`)
    lines.push(`application_url = "${applicationUrl}"`)
    lines.push(`embedded = ${embedded}`)

    if (webDirectories && webDirectories.length > 0) {
      lines.push(`web_directories = ${JSON.stringify(webDirectories)}`)
    }

    if (webhooksApiVersion !== null) {
      lines.push('')
      lines.push('[webhooks]')
      lines.push(`api_version = "${webhooksApiVersion}"`)
    }

    if (redirectUrls !== null) {
      lines.push('')
      lines.push('[auth]')
      lines.push(`redirect_urls = ${JSON.stringify(redirectUrls)}`)
    }

    if (build) {
      lines.push('')
      lines.push('[build]')
      for (const [key, value] of Object.entries(build)) {
        lines.push(`${key} = ${typeof value === 'string' ? `"${value}"` : value}`)
      }
    }

    if (access) {
      for (const [section, props] of Object.entries(access)) {
        lines.push('')
        lines.push(`[access.${section}]`)
        for (const [key, value] of Object.entries(props)) {
          lines.push(`${key} = ${typeof value === 'string' ? `"${value}"` : value}`)
        }
      }
    }

    if (extra) {
      lines.push('')
      lines.push(extra)
    }

    return lines.join('\n')
  }

  // Minimal configuration without webhook subscriptions - used for tests that check exact extension counts
  const minimalAppConfiguration = buildAppConfiguration()

  // Configuration for tests that check exact extension counts (no webhook subscriptions)
  const appConfiguration = minimalAppConfiguration
  // This configuration is used by tests that check specific metadata values
  const linkedAppConfiguration = buildAppConfiguration({
    name: 'for-testing',
    clientId: '1234567890',
    build: {automatically_update_urls_on_dev: true},
  })

  beforeAll(async () => {
    specifications = await loadLocalExtensionsSpecifications()
  })

  beforeEach(async () => {
    tmpDir = await mkTmpDir()
  })

  afterEach(async () => {
    if (tmpDir) {
      await rmdir(tmpDir, {force: true})
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
      await expect(loadApp({directory: tmp, specifications, userProvidedConfigName: undefined})).rejects.toThrow(
        `Couldn't find directory ${tmp}`,
      )
    })
  })

  test("throws an error if the configuration file doesn't exist", async () => {
    // Given
    const currentDir = cwd()

    // When/Then
    await expect(loadApp({directory: currentDir, specifications, userProvidedConfigName: undefined})).rejects.toThrow(
      `Couldn't find an app toml file at ${currentDir}`,
    )
  })

  test('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        scopes = 1
        `
    await writeConfig(appConfiguration)

    // When/Then
    await expect(loadTestingApp()).rejects.toThrow()
  })

  test('throws an error when the application_url is invalid', async () => {
    // Given
    const config = buildAppConfiguration({applicationUrl: 'wrong'})
    await writeConfig(config)

    // When/Then
    await expect(loadTestingApp()).rejects.toThrow(/\[application_url\]: Invalid URL/)
  })

  test('loads the app when the configuration is valid and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('my_app')
  })

  test('throws an error when the configuration file has invalid nested elements and the schema is generated from the specifications', async () => {
    // Given
    const config = buildAppConfiguration({
      webhooksApiVersion: null,
      redirectUrls: null,
      extra: '[access]\nwrong = "property"',
    })
    await writeConfig(config)

    // When/Then
    await expect(loadTestingApp()).rejects.toThrow()
  })

  test('loads the app when the configuration file has invalid nested elements but the schema isnt generated from the specifications', async () => {
    // Given
    const config = buildAppConfiguration({
      name: 'for-testing',
      webhooksApiVersion: null,
      redirectUrls: null,
      extra: '[access]\nwrong = "property"',
    })
    await writeConfig(config)

    // When
    const app = await loadApp({directory: tmpDir, specifications: [], userProvidedConfigName: undefined})

    // Then
    expect(app.name).toBe('for-testing')
  })

  test('uses handle from configuration as app name when present', async () => {
    // Given
    const config = buildAppConfiguration({name: 'display-name', handle: 'app-handle'})
    await writeConfig(config)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('app-handle')
  })

  test('uses name from configuration when handle is not present', async () => {
    // Given
    const config = buildAppConfiguration({name: 'config-name'})
    await writeConfig(config)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('config-name')
  })

  test('defaults to npm as the package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)
    vi.mocked(captureOutput).mockResolvedValue(tmpDir)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.packageManager).toBe('npm')
  })

  test('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const yarnLockPath = joinPath(tmpDir, yarnLockfile)
    await writeFile(yarnLockPath, '')
    vi.mocked(captureOutput).mockResolvedValue(tmpDir)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.packageManager).toBe('yarn')
  })

  test('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmLockPath = joinPath(tmpDir, pnpmLockfile)
    await writeFile(pnpmLockPath, '')
    vi.mocked(captureOutput).mockResolvedValue(tmpDir)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  test("identifies if the app doesn't use workspaces", async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await loadTestingApp()

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
    const app = await loadTestingApp()

    // Then
    expect(app.usesWorkspaces).toBe(true)
  })

  test('checks for multiple CLI installations', async () => {
    // Given
    await writeConfig(appConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })

    // When
    await loadTestingApp()

    // Then
    expect(showMultipleCLIWarningIfNeeded).toHaveBeenCalled()
  })

  test('identifies if the app uses pnpm workspaces', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmWorkspaceFilePath = joinPath(tmpDir, pnpmWorkspaceFile)
    await writeFile(pnpmWorkspaceFilePath, '')

    // When
    const app = await loadTestingApp()

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
    let app = await loadTestingApp()
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
    app = await loadTestingApp()

    // Then
    expect(app.usesWorkspaces).toBe(true)
    expect(app.webs.length).toBe(1)
  }, 30000)

  test("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({name: 'my-extension'})

    // When
    await expect(loadTestingApp()).rejects.toThrow(/Couldn't find an app toml file at/)
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
      type = "ui_extension"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(loadTestingApp()).rejects.toThrow(/Validation errors/)
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
    await expect(loadTestingApp()).rejects.toThrow(/Invalid extension type "invalid_type"/)
  })

  test('loads only known extension types when mode is local', async () => {
    // Given
    await writeConfig(appConfiguration)

    // Create two extensions: one known and one unknown
    const knownBlockConfiguration = `
      name = "my_extension"
      type = "theme"
      `
    await writeBlockConfig({
      blockConfiguration: knownBlockConfiguration,
      name: 'my-known-extension',
    })
    await writeFile(joinPath(blockPath('my-known-extension'), 'index.js'), '')

    const unknownBlockConfiguration = `
      name = "unknown_extension"
      type = "unknown_type"
      `
    await writeBlockConfig({
      blockConfiguration: unknownBlockConfiguration,
      name: 'my-unknown-extension',
    })
    await writeFile(joinPath(blockPath('my-unknown-extension'), 'index.js'), '')

    // When
    const app = await loadTestingApp({mode: 'local'})

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    expect(realExtensions[0]!.configuration.name).toBe('my_extension')
    expect(realExtensions[0]!.configuration.type).toBe('theme')
    expect(app.errors).toBeUndefined()
  })

  test('throws error for duplicated handles when mode is local', async () => {
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

    // When/Then
    await expect(loadTestingApp({mode: 'local'})).rejects.toThrow(/Duplicated handle/)
  })

  test('does not throw error for duplicated handles when mode is report', async () => {
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

    // When/Then
    await expect(loadTestingApp({mode: 'report'})).resolves.not.toThrow()
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
    await expect(loadTestingApp()).rejects.toThrow(/Duplicated handle/)
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
    await expect(loadTestingApp()).rejects.toThrow(/Missing handle for extension "my_extension"/)
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
    await expect(loadTestingApp()).rejects.toThrow(/Invalid extension type/)
  })

  test('loads the app with web blocks', async () => {
    // Given
    const {webDirectory} = await writeConfig(appConfiguration)
    await moveFile(webDirectory, joinPath(tmpDir, 'we_check_everywhere'))

    // When
    const app = await loadTestingApp()

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
    try {
      await loadTestingApp()
      expect.fail('Expected loadTestingApp to throw an error')
    } catch (error) {
      if (!(error instanceof AbortError)) {
        throw error
      }
      expect(error.message).toContain('You can only have one "web" configuration file with the [33mbackend[39m role')
      expect(error.message).toContain('Conflicting configurations found at:')
      expect(error.message).toContain(joinPath(webDirectory, configurationFileNames.web))
      expect(error.message).toContain(joinPath(anotherWebDirectory, configurationFileNames.web))
    }
  })

  test('throws an error if there are multiple frontends', async () => {
    // Given
    const {webDirectory} = await writeConfig(appConfiguration)
    await writeWebConfiguration({webDirectory, role: 'frontend'})
    const anotherWebDirectory = joinPath(webDirectory, '..', 'another_web_dir')
    await mkdir(anotherWebDirectory)
    await writeWebConfiguration({webDirectory: anotherWebDirectory, role: 'frontend'})

    // Then
    try {
      await loadTestingApp()
      expect.fail('Expected loadTestingApp to throw an error')
    } catch (error) {
      if (!(error instanceof AbortError)) {
        throw error
      }
      expect(error.message).toContain('You can only have one "web" configuration file with the [33mfrontend[39m role')
      expect(error.message).toContain('Conflicting configurations found at:')
      expect(error.message).toContain(joinPath(webDirectory, configurationFileNames.web))
      expect(error.message).toContain(joinPath(anotherWebDirectory, configurationFileNames.web))
    }
  })

  test('loads the app with custom located web blocks', async () => {
    // Given
    const config = buildAppConfiguration({webDirectories: ['must_be_here']})
    const {webDirectory} = await writeConfig(config)
    await moveFile(webDirectory, joinPath(tmpDir, 'must_be_here'))

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.webs.length).toBe(1)
  })

  test('loads the app with custom located web blocks, only checks given directory', async () => {
    // Given
    const config = buildAppConfiguration({webDirectories: ['must_be_here']})
    const {webDirectory} = await writeConfig(config)
    await moveFile(webDirectory, joinPath(tmpDir, 'cannot_be_here'))

    // When
    const app = await loadTestingApp()

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
    const app = await loadTestingApp()

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
    const app = await loadTestingApp()

    // Then
    expect(app.allExtensions[0]!.configuration.name).toBe('my_extension')
    expect(app.allExtensions[0]!.idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.allExtensions[0]!.localIdentifier).toBe('my-extension')
  })

  test('loads the app when it has a extension with a valid configuration using a supported extension type and in a non-conventional directory configured in the app configuration file', async () => {
    // Given
    await writeConfig(`
    name = "test-app"
    client_id = "test-client-id"
    application_url = "https://example.com"
    embedded = true
    extension_directories = ["custom_extension"]

    [auth]
    redirect_urls = ["https://example.com/callback"]

    [webhooks]
    api_version = "2024-01"
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
    const app = await loadTestingApp()

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
    const app = await loadApp({directory: blockDir, specifications, userProvidedConfigName: undefined})

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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(2)
    const extensions = realExtensions.sort((extA: ExtensionInstance, extB: ExtensionInstance) =>
      extA.name < extB.name ? -1 : 1,
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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(2)
    const extensions = realExtensions.sort((extA: ExtensionInstance, extB: ExtensionInstance) =>
      extA.name < extB.name ? -1 : 1,
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
    await expect(loadTestingApp()).resolves.not.toBeUndefined()
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
    await expect(loadApp({directory: blockDir, specifications, userProvidedConfigName: undefined})).rejects.toThrow(
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
    await expect(() => loadTestingApp()).rejects.toThrowError()
  })

  test("throws an error if the configuration file doesn't exist", async () => {
    // Given
    await makeBlockDir({name: 'my-functions'})

    // When
    await expect(loadTestingApp()).rejects.toThrow(/Couldn't find an app toml file at/)
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
    await expect(() => loadTestingApp()).rejects.toThrowError()
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
    await expect(() => loadTestingApp()).rejects.toThrowError()
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })
    await mkdir(joinPath(blockPath('my-function'), 'src'))
    await writeFile(joinPath(blockPath('my-function'), 'src', 'index.js'), '')

    // When
    const app = await loadTestingApp()
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-flow-trigger',
    })

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-flow-action',
    })

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[extensions.invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-function',
    })

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[extensions.invalid_field]]
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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

        [extensions.capabilities.iframe]
        sources = ["https://my-iframe.com"]

        [extensions.supported_features]
        offline_mode = true

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

            # extra fields not included in the schema should be ignored
      [[extensions.invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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
          iframe: {
            sources: ['https://my-iframe.com'],
          },
        },
        supported_features: {
          offline_mode: true,
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-checkout-post-purchase',
    })

    await writeFile(joinPath(blockPath('my-checkout-post-purchase'), 'index.js'), '/** content **/')

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-tax-calculation',
    })

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'pixel',
    })
    await writeFile(joinPath(blockPath('pixel'), 'index.js'), '')

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'pixel',
    })
    await writeFile(joinPath(blockPath('pixel'), 'index.js'), '')

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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

      [capabilities.iframe]
      sources = ["https://my-iframe.com"]

      [settings]
        [[settings.fields]]
        key = "field_key"
        type = "boolean"
        name = "field-name"
        [[settings.fields]]
        key = "field_key_2"
        type = "number_integer"
        name = "field-name-2"

      # extra fields not included in the schema should be ignored
      [[invalid_field]]
      namespace = "my-namespace"
      key = "my-key"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my-checkout-extension',
    })

    await writeFile(joinPath(blockPath('my-checkout-extension'), 'index.js'), '')

    // When
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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
          iframe: {
            sources: ['https://my-iframe.com'],
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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(1)
    const extension = realExtensions[0]
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
    const app = await loadTestingApp()

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

  test('loads the app with webhook subscription extensions created individually', async () => {
    // Given
    const appConfigurationWithWebhooks = `
    name = "for-testing-webhooks"
    client_id = "1234567890"
    application_url = "https://example.com/lala"
    embedded = true

    [build]
    include_config_on_deploy = true

    [webhooks]
    api_version = "2024-01"

    [[webhooks.subscriptions]]
      topics = ["orders/create", "orders/delete"]
      uri = "https://example.com"

    [auth]
    redirect_urls = [ "https://example.com/api/auth" ]
    `
    await writeConfig(appConfigurationWithWebhooks)

    // When
    const app = await loadTestingApp({remoteFlags: []})

    // Then
    expect(app.allExtensions).toHaveLength(6)
    const extensionsConfig = app.allExtensions.map((ext) => ext.configuration)
    expect(extensionsConfig).toEqual([
      {
        name: 'for-testing-webhooks',
      },
      {
        auth: {
          redirect_urls: ['https://example.com/api/auth'],
        },
        name: 'for-testing-webhooks',
      },
      // this is the webhooks extension
      {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {topics: ['orders/create'], uri: 'https://example.com'},
            {topics: ['orders/delete'], uri: 'https://example.com'},
          ],
        },
        name: 'for-testing-webhooks',
      },
      {
        application_url: 'https://example.com/lala',
        embedded: true,
        name: 'for-testing-webhooks',
      },
      // this is a webhook subscription extension
      {
        api_version: '2024-01',
        topic: 'orders/create',
        uri: 'https://example.com',
      },
      // this is a webhook subscription extension
      {
        api_version: '2024-01',
        topic: 'orders/delete',
        uri: 'https://example.com',
      },
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
    const app = await loadTestingApp()

    // Then
    const realExtensions = getRealExtensions(app)
    expect(realExtensions).toHaveLength(2)
    const functions = realExtensions.sort((extA: ExtensionInstance, extB: ExtensionInstance) =>
      extA.name < extB.name ? -1 : 1,
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
    const app = await loadTestingApp()

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
    const app = await loadTestingApp()

    // Then
    expect(app.allExtensions[0]!.outputPath).toMatch(/.+dist\/index.wasm$/)
  })

  test(`updates metadata after loading`, async () => {
    const {webDirectory} = await writeConfig(appConfiguration)
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await loadTestingApp()

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      project_type: 'node',
      env_package_manager_workspaces: false,
      cmd_app_all_configs_any: true,
      cmd_app_all_configs_clients: JSON.stringify({'shopify.app.toml': 'test-client-id'}),
      cmd_app_linked_config_used: true,
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

    await loadTestingApp()

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      project_type: 'node',
      env_package_manager_workspaces: true,
      cmd_app_all_configs_any: true,
      cmd_app_all_configs_clients: JSON.stringify({'shopify.app.toml': 'test-client-id'}),
      cmd_app_linked_config_used: true,
    })
  })

  test('throws error if config file is passed in but does not exist', async () => {
    // Given
    await writeConfig(linkedAppConfiguration)
    vi.mocked(getCachedAppInfo).mockReturnValue({directory: tmpDir, configFile: 'shopify.app.non-existent.toml'})
    vi.mocked(use).mockResolvedValue('shopify.app.toml')

    // When
    const result = loadApp({directory: tmpDir, specifications, userProvidedConfigName: 'non-existent'})

    // Then
    await expect(result).rejects.toThrow()
    expect(use).not.toHaveBeenCalled()
  })

  test('loads the app when access.admin.direct_api_mode = "online"', async () => {
    // Given
    const config = buildAppConfiguration({access: {admin: {direct_api_mode: 'online'}}})
    await writeConfig(config)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('my_app')
  })

  test('loads the app when access.admin.direct_api_mode = "offline"', async () => {
    // Given
    const config = buildAppConfiguration({access: {admin: {direct_api_mode: 'offline'}}})
    await writeConfig(config)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('my_app')
  })

  test('throws an error when access.admin.direct_api_mode is invalid', async () => {
    // Given
    const config = buildAppConfiguration({access: {admin: {direct_api_mode: 'foo'}}})
    await writeConfig(config)

    // When
    await expect(loadTestingApp()).rejects.toThrow()
  })

  test('loads the app when access.admin.embedded_app_direct_api_access = true', async () => {
    // Given
    const config = buildAppConfiguration({access: {admin: {embedded_app_direct_api_access: true}}})
    await writeConfig(config)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('my_app')
  })

  test('loads the app when access.admin.embedded_app_direct_api_access = false', async () => {
    // Given
    const config = buildAppConfiguration({access: {admin: {embedded_app_direct_api_access: false}}})
    await writeConfig(config)

    // When
    const app = await loadTestingApp()

    // Then
    expect(app.name).toBe('my_app')
  })

  test('throws an error when access.admin.embedded_app_direct_api_access is invalid', async () => {
    // Given
    const config = buildAppConfiguration({extra: '[access.admin]\nembedded_app_direct_api_access = "foo"'})
    await writeConfig(config)

    // When
    await expect(loadTestingApp()).rejects.toThrow()
  })

  test('regenerates devApplicationURLs when reloading', async () => {
    // Given
    const appConfiguration = `
      name = "my-app"
      client_id = "12345"
      application_url = "https://example.com"
      embedded = true

      [webhooks]
      api_version = "2023-07"

      [auth]
      redirect_urls = ["https://example.com/auth"]

      [app_proxy]
      url = "https://example.com"
      subpath = "updated"
      prefix = "new"
    `
    await writeConfig(appConfiguration)

    const blockConfiguration = `
     api_version = "2022-07"

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

    // Create initial app
    const app = (await loadApp({
      directory: tmpDir,
      specifications,
      userProvidedConfigName: undefined,
    })) as AppLinkedInterface

    // Set some values that should be regenerated
    const customDevUUID = 'custom-dev-uuid'
    const customAppURLs = {
      applicationUrl: 'http://custom.dev',
      redirectUrlWhitelist: ['http://custom.dev/auth'],
      appProxy: {
        proxyUrl: 'https://example.com',
        proxySubPath: 'initial',
        proxySubPathPrefix: 'old',
      },
    }
    app.allExtensions[0]!.devUUID = customDevUUID
    app.setDevApplicationURLs(customAppURLs)

    // When
    const reloadedApp = await reloadApp(app)

    // Then
    expect(reloadedApp.allExtensions[0]?.devUUID).toBe(customDevUUID)
    expect(reloadedApp.devApplicationURLs).toEqual({
      applicationUrl: 'http://custom.dev',
      redirectUrlWhitelist: [
        'http://custom.dev/auth/callback',
        'http://custom.dev/auth/shopify/callback',
        'http://custom.dev/api/auth/callback',
      ],
      appProxy: {
        proxyUrl: 'https://custom.dev',
        proxySubPath: 'updated',
        proxySubPathPrefix: 'new',
      },
    })
    expect(reloadedApp.name).toBe(app.name)
    expect(reloadedApp.packageManager).toBe(app.packageManager)
    expect(reloadedApp.nodeDependencies).toEqual(app.nodeDependencies)
    expect(reloadedApp.usesWorkspaces).toBe(app.usesWorkspaces)
  })

  test('call app.generateExtensionTypes', async () => {
    // Given
    await writeConfig(appConfiguration)
    const generateTypesSpy = vi.spyOn(App.prototype, 'generateExtensionTypes')

    // When
    await loadTestingApp()

    // Then
    expect(generateTypesSpy).toHaveBeenCalled()
    generateTypesSpy.mockRestore()
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
      await loadTestingApp()

      // Then
      expect(use).toHaveBeenCalledWith({
        directory: normalizePath(tmpDir),
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
    await writeFile(joinPath(tmpDir, '.gitignore'), '')

    await loadTestingApp()

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
      cmd_app_warning_api_key_deprecation_displayed: false,
      app_extensions_any: false,
      app_extensions_breakdown: {},
      app_extensions_count: 0,
      app_extensions_custom_layout: false,
      app_extensions_function_any: false,
      app_extensions_function_count: 0,
      app_extensions_theme_any: false,
      app_extensions_theme_count: 0,
      app_extensions_ui_any: false,
      app_extensions_ui_count: 0,
      app_name_hash: expect.any(String),
      app_path_hash: expect.any(String),
      app_scopes: '[]',
      app_web_backend_any: true,
      app_web_backend_count: 1,
      app_web_custom_layout: false,
      app_web_framework: 'unknown',
      app_web_frontend_any: false,
      app_web_frontend_count: 0,
    })
  })

  test.skipIf(runningOnWindows)(`git_tracked metadata is false when ignored by the gitignore`, async () => {
    const {webDirectory} = await writeConfig(linkedAppConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))
    await writeFile(joinPath(tmpDir, '.gitignore'), 'shopify.app.toml')

    await loadTestingApp()

    expect(metadata.getAllPublicMetadata()).toEqual(
      expect.objectContaining({
        cmd_app_linked_config_git_tracked: false,
      }),
    )
  })

  test.skipIf(runningOnWindows)(`git_tracked metadata is true when there is no gitignore`, async () => {
    const {webDirectory} = await writeConfig(linkedAppConfiguration, {
      workspaces: ['packages/*'],
      name: 'my_app',
      dependencies: {},
      devDependencies: {},
    })
    await writeFile(joinPath(webDirectory, 'package.json'), JSON.stringify({}))

    await loadTestingApp()

    expect(metadata.getAllPublicMetadata()).toEqual(
      expect.objectContaining({
        cmd_app_linked_config_git_tracked: true,
      }),
    )
  })

  test('throws the correct error when multi-extension configuration is invalid', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      api_version = "2022-07"
      description = "global description"

      [extensions]
      type = "checkout_post_purchase"
      name = "my_extension_1"
      handle = "checkout-ext"
      description = "custom description"
      `
    await writeBlockConfig({
      blockConfiguration,
      name: 'my_extension_1',
    })
    await writeFile(joinPath(blockPath('my_extension_1'), 'index.js'), '')

    await expect(loadTestingApp()).rejects.toThrow(AbortError)
  })

  test('loads the app with an unsupported config property', async () => {
    const linkedAppConfigurationWithExtraConfig = `
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

    [something_else]
    not_valid = true

    [and_another]
    bad = true
    `
    await writeConfig(linkedAppConfigurationWithExtraConfig)

    await expect(loadTestingApp()).rejects.toThrow(
      'Unsupported section(s) in app configuration: and_another, something_else',
    )
  })

  test('does not throw unsupported config property error when mode is local', async () => {
    const linkedAppConfigurationWithExtraConfig = `
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

    [something_else]
    not_valid = true

    [and_another]
    bad = true
    `
    await writeConfig(linkedAppConfigurationWithExtraConfig)

    const app = await loadTestingApp({mode: 'local'})

    expect(app).toBeDefined()
    expect(app.name).toBe('for-testing')
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

describe('checkFolderIsValidApp', () => {
  test('throws an error if the folder does not contain a shopify.app.toml file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // When
      const result = checkFolderIsValidApp(tmp)

      // Then
      await expect(result).rejects.toThrow(/Couldn't find an app toml file at/)
    })
  })

  test('doesnt throw an error if the folder does contains a shopify.app.toml file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      await writeFile(joinPath(tmp, 'shopify.app.toml'), '')

      // When
      const result = checkFolderIsValidApp(tmp)

      // Then
      await expect(result).resolves.toBeUndefined()
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
        message: 'Boolean is required',
      },
    ]
    const expectedFormatted = outputContent`\n${outputToken.errorText(
      'Validation errors',
    )} in tmp:\n\n${parseHumanReadableError(errorObject)}`

    const abortOrReport = vi.fn()

    const {schema} = await buildVersionedAppSchema()
    const {path, ...toParse} = configurationObject
    await parseConfigurationObject(schema, 'tmp', toParse, abortOrReport)

    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('throws an error when client_id is missing in app schema TOML file', async () => {
    const configurationObject = {
      scopes: [],
    }

    const abortOrReport = vi.fn()
    await parseConfigurationObject(AppSchema, 'tmp', configurationObject, abortOrReport)

    expect(abortOrReport).toHaveBeenCalledOnce()
    const errorString = abortOrReport.mock.calls[0]![0].value
    expect(errorString).toContain('[client_id]: Required')
  })

  test('throws an error if fields are missing in a frontend config web TOML file', async () => {
    const configurationObject = {
      type: 11,
      commands: {dev: ''},
      roles: 1,
    }

    const abortOrReport = vi.fn()
    await parseConfigurationObject(WebConfigurationSchema, 'tmp', configurationObject, abortOrReport)

    // Verify the function was called and capture the actual error structure
    expect(abortOrReport).toHaveBeenCalledOnce()
    const callArgs = abortOrReport.mock.calls[0]!
    const actualErrorMessage = callArgs[0]

    // Convert TokenizedString to regular string for testing
    const errorString = actualErrorMessage.value

    // The enhanced union handling should show only the most relevant errors
    // instead of showing all variants, making it much more user-friendly
    expect(errorString).toContain('[roles]: Expected array, received number')

    // Should NOT show the confusing union variant breakdown
    expect(errorString).not.toContain('Union validation failed')
    expect(errorString).not.toContain('Option 1:')
    expect(errorString).not.toContain('Option 2:')
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
      code: zod.ZodIssueCode.custom,
      message:
        "URI format isn't correct. Valid formats include: relative path starting with a slash, HTTPS URL, pubsub://{project-id}:{topic-id} or Eventbridge ARN",
      path: ['webhooks', 'subscriptions', 0, 'uri'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
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
      code: zod.ZodIssueCode.custom,
      message:
        "URI format isn't correct. Valid formats include: relative path starting with a slash, HTTPS URL, pubsub://{project-id}:{topic-id} or Eventbridge ARN",
      path: ['webhooks', 'subscriptions', 0, 'uri'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
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

    const expandedWebhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          topics: ['products/create'],
        },
        {
          uri: 'arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/1234567890/SOME_PATH',
          topics: ['products/update'],
        },
        {
          uri: 'https://example.com',
          topics: ['products/create'],
        },
        {
          uri: 'https://example.com',
          topics: ['products/update'],
        },
        {
          uri: 'pubsub://my-project-123:my-topic',
          topics: ['products/create'],
        },
        {
          uri: 'pubsub://my-project-123:my-topic',
          topics: ['products/update'],
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(expandedWebhookConfig)
  })

  test('throws an error if we have duplicate subscriptions in same topics array', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [{uri: 'https://example.com', topics: ['products/create', 'products/create']}],
    }
    const webhookFields = colors.dim(`\n\ntopic: products/create\nuri: https://example.com`)
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('throws an error if we have duplicate subscriptions in different topics array', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {uri: 'https://example.com', topics: ['products/create']},
        {uri: 'https://example.com', topics: ['products/create', 'products/update']},
      ],
    }
    const webhookFields = colors.dim(`\n\ntopic: products/create\nuri: https://example.com`)
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
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
      code: zod.ZodIssueCode.custom,
      message:
        "URI format isn't correct. Valid formats include: relative path starting with a slash, HTTPS URL, pubsub://{project-id}:{topic-id} or Eventbridge ARN",
      path: ['webhooks', 'subscriptions', 0, 'uri'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
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
    const webhookFields = colors.dim(`\n\ntopic: products/create\nuri: https://example.com`)
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
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
    const webhookFields = colors.dim(`\n\ntopic: products/create\nuri: pubsub://my-project-123:my-topic`)
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
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
    const webhookFields = colors.dim(
      `\n\ntopic: products/create\nuri: arn:aws:events:us-west-2::event-source/aws.partner/shopify.com/123/my_webhook_path`,
    )
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('does not allow identical topic and uri and filter in different subscriptions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/update'],
          uri: 'https://example.com',
          filter: 'title:shoes',
        },
        {
          topics: ['products/update'],
          uri: 'https://example.com',
          filter: 'title:shoes',
        },
      ],
    }
    const webhookFields = colors.dim(`\n\ntopic: products/update\nuri: https://example.com\nfilter: title:shoes`)
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('shows multiple duplicate subscriptions in error message', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/update'],
          uri: 'https://example.com',
          filter: 'title:shoes',
        },
        {
          topics: ['products/update'],
          uri: 'https://example.com',
          filter: 'title:shoes',
        },
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
    const webhookFields =
      colors.dim(`\n\ntopic: products/update\nuri: https://example.com\nfilter: title:shoes`) +
      colors.dim(`\n\ntopic: products/create\nuri: https://example.com`)
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${webhookFields}`,
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('allows identical topic and uri if filter is different', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          topics: ['products/update'],
          uri: 'https://example.com',
          filter: 'title:shoes',
        },
        {
          topics: ['products/update'],
          uri: 'https://example.com',
          filter: 'title:shirts',
        },
      ],
    }

    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('throws an error if we have privacy_compliance section and subscriptions with compliance_topics', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      privacy_compliance: {
        customer_data_request_url: 'https://example.com',
      },
      subscriptions: [
        {
          compliance_topics: ['customers/data_request'],
          uri: 'https://example.com',
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: `The privacy_compliance section can't be used if there are subscriptions including compliance_topics`,
      path: ['webhooks'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('throws an error if neither topics nor compliance_topics are added', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          uri: 'https://example.com',
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'Either topics or compliance_topics must be added to the webhook subscription',
      path: ['webhooks', 'subscriptions', 0],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('throws an error when there are duplicated compliance topics', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2021-07',
      subscriptions: [
        {
          uri: 'https://example.com',
          compliance_topics: ['customers/data_request'],
        },
        {
          uri: 'https://example.com/other',
          compliance_topics: ['customers/data_request'],
        },
      ],
    }
    const errorObj = {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have multiple subscriptions with the same compliance topic',
      fatal: true,
      path: ['webhooks', 'subscriptions'],
    }

    const {abortOrReport, expectedFormatted} = await setupParsing(errorObj, webhookConfig)
    expect(abortOrReport).toHaveBeenCalledWith(expectedFormatted, {}, 'tmp')
  })

  test('accepts webhook subscription with payload_query', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2024-01',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'https://example.com/webhooks',
          payload_query: 'query { product { id title } }',
        },
      ],
    }
    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('accepts webhook subscription with name', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2024-01',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'https://example.com/webhooks',
          name: 'products/create',
        },
      ],
    }
    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  test('accepts webhook subscription with actions', async () => {
    const webhookConfig: WebhooksConfig = {
      api_version: '2024-01',
      subscriptions: [
        {
          topics: ['products/create'],
          uri: 'https://example.com/webhooks',
          actions: ['create'],
        },
      ],
    }
    const {abortOrReport, parsedConfiguration} = await setupParsing({}, webhookConfig)
    expect(abortOrReport).not.toHaveBeenCalled()
    expect(parsedConfiguration.webhooks).toMatchObject(webhookConfig)
  })

  async function setupParsing(errorObj: zod.ZodIssue | {}, webhookConfigOverrides: WebhooksConfig) {
    const err = Array.isArray(errorObj) ? errorObj : [errorObj]
    const expectedFormatted = outputContent`\n${outputToken.errorText(
      'Validation errors',
    )} in tmp:\n\n${parseHumanReadableError(err)}`
    const abortOrReport = vi.fn()

    const {path, ...toParse} = getWebhookConfig(webhookConfigOverrides)
    const parsedConfiguration = await parseConfigurationObject(WebhooksSchema, 'tmp', toParse, abortOrReport)
    return {abortOrReport, expectedFormatted, parsedConfiguration}
  }
})

describe('getAppConfigurationState', () => {
  test.each([
    [
      `client_id="abcdef"`,
      {
        basicConfiguration: {
          path: expect.stringMatching(/shopify.app.toml$/),
          client_id: 'abcdef',
        },
        isTemplateForm: false,
      },
    ],
    [
      `client_id="abcdef"
      something_extra="keep"`,
      {
        basicConfiguration: {
          path: expect.stringMatching(/shopify.app.toml$/),
          client_id: 'abcdef',
          something_extra: 'keep',
        },
        isTemplateForm: false,
      },
    ],
    [
      `client_id=""`,
      {
        basicConfiguration: {
          path: expect.stringMatching(/shopify.app.toml$/),
          client_id: '',
        },
        isTemplateForm: true,
      },
    ],
  ])('loads from %s', async (content, resultShouldContain) => {
    await inTemporaryDirectory(async (tmpDir) => {
      const appConfigPath = joinPath(tmpDir, 'shopify.app.toml')
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      await writeFile(appConfigPath, content)
      await writeFile(packageJsonPath, '{}')

      const state = await getAppConfigurationState(tmpDir, undefined)
      expect(state).toMatchObject(resultShouldContain)
    })
  })

  test('marks config as template when client_id is empty string', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const content = `client_id = ""\nsomething_extra = "some_value"`
      const appConfigPath = joinPath(tmpDir, 'shopify.app.toml')
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      await writeFile(appConfigPath, content)
      await writeFile(packageJsonPath, '{}')

      const result = await getAppConfigurationState(tmpDir, undefined)

      expect(result.basicConfiguration.client_id).toBe('')
      expect(result.isTemplateForm).toBe(true)
    })
  })
})

describe('loadConfigForAppCreation', () => {
  test('extracts access_scopes.scopes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = `
client_id = ""
name = "my-app"

[access_scopes]
scopes = "read_orders,write_products"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      const result = await loadConfigForAppCreation(tmpDir, 'my-app')

      expect(result).toEqual({
        isLaunchable: false,
        scopesArray: ['read_orders', 'write_products'],
        name: 'my-app',
        directory: normalizePath(tmpDir),
        isEmbedded: false,
      })
    })
  })

  test('defaults to empty scopes when access_scopes section is missing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = `
client_id = ""
name = "my-app"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      const result = await loadConfigForAppCreation(tmpDir, 'my-app')

      expect(result).toEqual({
        isLaunchable: false,
        scopesArray: [],
        name: 'my-app',
        directory: normalizePath(tmpDir),
        isEmbedded: false,
      })
    })
  })

  test('detects launchable app with frontend web', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = `
client_id = ""
name = "my-app"

[access_scopes]
scopes = "write_products"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')
      await writeFile(
        joinPath(tmpDir, 'shopify.web.toml'),
        `roles = ["frontend"]
name = "web"

[commands]
dev = "echo 'dev'"
        `,
      )

      const result = await loadConfigForAppCreation(tmpDir, 'my-app')

      expect(result).toEqual({
        isLaunchable: true,
        scopesArray: ['write_products'],
        name: 'my-app',
        directory: normalizePath(tmpDir),
        isEmbedded: true,
      })
    })
  })

  test('ignores unknown configuration sections', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = `
client_id = ""
name = "my-app"

[access_scopes]
scopes = "write_products"

[product.metafields.app.example]
type = "single_line_text_field"
name = "Example"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      const result = await loadConfigForAppCreation(tmpDir, 'my-app')

      expect(result).toEqual({
        isLaunchable: false,
        scopesArray: ['write_products'],
        name: 'my-app',
        directory: normalizePath(tmpDir),
        isEmbedded: false,
      })
    })
  })

  test('ignores completely unrecognized configuration sections', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = `
client_id = ""
name = "my-app"
nonsense_field = "whatever"

[access_scopes]
scopes = "write_products"

[completely_made_up]
foo = "bar"
baz = 123

[another.deeply.nested.thing]
value = true
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      const result = await loadConfigForAppCreation(tmpDir, 'my-app')

      expect(result).toEqual({
        isLaunchable: false,
        scopesArray: ['write_products'],
        name: 'my-app',
        directory: normalizePath(tmpDir),
        isEmbedded: false,
      })
    })
  })
})

describe('loadHiddenConfig', () => {
  test('returns empty object if hidden config file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configuration = {
        path: joinPath(tmpDir, 'shopify.app.toml'),
        client_id: '12345',
      }
      await writeFile(joinPath(tmpDir, '.gitignore'), '')

      // When
      const got = await loadHiddenConfig(tmpDir, configuration)

      // Then
      expect(got).toEqual({})

      // Verify empty config file was created
      const hiddenConfigPath = joinPath(tmpDir, '.shopify', 'project.json')
      const fileContent = await readFile(hiddenConfigPath)
      expect(JSON.parse(fileContent)).toEqual({})
    })
  })

  test('returns config for client_id if hidden config file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configuration = {
        path: joinPath(tmpDir, 'shopify.app.toml'),
        client_id: '12345',
      }
      const hiddenConfigPath = joinPath(tmpDir, '.shopify', 'project.json')
      await mkdir(dirname(hiddenConfigPath))
      await writeFile(
        hiddenConfigPath,
        JSON.stringify({
          '12345': {someKey: 'someValue'},
          'other-id': {otherKey: 'otherValue'},
        }),
      )

      // When
      const got = await loadHiddenConfig(tmpDir, configuration)

      // Then
      expect(got).toEqual({someKey: 'someValue'})
    })
  })

  test('returns empty object if client_id not found in existing hidden config', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configuration = {
        path: joinPath(tmpDir, 'shopify.app.toml'),
        client_id: 'not-found',
      }
      const hiddenConfigPath = joinPath(tmpDir, '.shopify', 'project.json')
      await mkdir(dirname(hiddenConfigPath))
      await writeFile(
        hiddenConfigPath,
        JSON.stringify({
          'other-id': {someKey: 'someValue'},
        }),
      )

      // When
      const got = await loadHiddenConfig(tmpDir, configuration)

      // Then
      expect(got).toEqual({})
    })
  })

  test('returns config if hidden config has an old format with just a dev_store_url', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configuration = {
        path: joinPath(tmpDir, 'shopify.app.toml'),
        client_id: 'not-found',
      }
      const hiddenConfigPath = joinPath(tmpDir, '.shopify', 'project.json')
      await mkdir(dirname(hiddenConfigPath))
      await writeFile(
        hiddenConfigPath,
        JSON.stringify({
          dev_store_url: 'https://dev-store.myshopify.com',
        }),
      )

      // When
      const got = await loadHiddenConfig(tmpDir, configuration)

      // Then
      expect(got).toEqual({dev_store_url: 'https://dev-store.myshopify.com'})
    })
  })

  test('returns empty object if hidden config file is invalid JSON', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configuration = {
        path: joinPath(tmpDir, 'shopify.app.toml'),
        client_id: '12345',
      }
      const hiddenConfigPath = joinPath(tmpDir, '.shopify', 'project.json')
      await mkdir(dirname(hiddenConfigPath))
      await writeFile(hiddenConfigPath, 'invalid json')

      // When
      const got = await loadHiddenConfig(tmpDir, configuration)

      // Then
      expect(got).toEqual({})
    })
  })
})

describe('loadOpaqueApp', () => {
  let specifications: ExtensionSpecification[]

  beforeAll(async () => {
    specifications = await loadLocalExtensionsSpecifications()
  })

  test('returns loaded-app state when app loads successfully', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a valid linked app configuration
      const config = `
client_id = "12345"
name = "my-app"
application_url = "https://example.com"
embedded = true

[webhooks]
api_version = "2023-07"

[auth]
redirect_urls = ["https://example.com/callback"]
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'report',
      })

      // Then
      expect(result.state).toBe('loaded-app')
      if (result.state === 'loaded-app') {
        expect(result.app).toBeDefined()
        expect(result.configuration.client_id).toBe('12345')
      }
    })
  })

  test('returns loaded-app state for template app configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a template app configuration with empty client_id
      const config = `
client_id = ""
name = "my-app"
application_url = "https://example.com"
embedded = true

[webhooks]
api_version = "2023-07"

[access_scopes]
scopes = "write_products,read_orders"

[auth]
redirect_urls = ["https://example.com/callback"]
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'report',
      })

      // Then
      expect(result.state).toBe('loaded-app')
      if (result.state === 'loaded-app') {
        expect(result.app).toBeDefined()
      }
    })
  })

  test('returns loaded-template state when config has extra keys that fail strict validation', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a template with metafield configuration that would fail loadApp
      const config = `
client_id = ""
name = "my-app"

[access_scopes]
scopes = "write_products"

[product.metafields.app.example]
type = "single_line_text_field"
name = "Example"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      // Strict mode will cause loadApp to fail due to extra config keys
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'strict',
      })

      // Then
      expect(result.state).toBe('loaded-template')
      if (result.state === 'loaded-template') {
        expect(result.scopes).toBe('write_products')
        expect(result.appDirectory).toBe(normalizePath(tmpDir))
        expect(result.rawConfig).toHaveProperty('product')
      }
    })
  })

  test('returns loaded-template with extra unknown sections', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a template with access_scopes format and extra config
      const config = `
client_id = ""
name = "my-app"

[access_scopes]
scopes = "read_orders,write_products"

[completely_unknown_section]
foo = "bar"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'strict',
      })

      // Then
      expect(result.state).toBe('loaded-template')
      if (result.state === 'loaded-template') {
        expect(result.scopes).toBe('read_orders,write_products')
      }
    })
  })

  test('returns error state when config file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - no config file
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'report',
      })

      // Then
      expect(result.state).toBe('error')
    })
  })

  test('preserves all raw config keys in loaded-template state for merging', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a template with various configuration sections
      const config = `
scopes = "write_products"
name = "my-app"

[metaobjects.app.author]
name = "Author"

[metaobjects.app.author.fields.name]
type = "single_line_text_field"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'strict',
      })

      // Then
      expect(result.state).toBe('loaded-template')
      if (result.state === 'loaded-template') {
        expect(result.rawConfig).toHaveProperty('metaobjects')
        expect(result.rawConfig).toHaveProperty('name', 'my-app')
        expect(result.rawConfig).toHaveProperty('scopes', 'write_products')
      }
    })
  })

  test('uses specified configName parameter when loading', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a custom config file name
      const config = `
client_id = "12345"
name = "my-app"
application_url = "https://example.com"
embedded = true

[webhooks]
api_version = "2023-07"

[access_scopes]
scopes = "write_products"

[auth]
redirect_urls = ["https://example.com/callback"]
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.staging.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        configName: 'shopify.app.staging.toml',
        mode: 'report',
      })

      // Then
      expect(result.state).toBe('loaded-app')
      if (result.state === 'loaded-app') {
        expect(result.app).toBeDefined()
      }
    })
  })

  test('returns package manager in loaded-template state', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a template with extra config
      const config = `
scopes = "write_products"
name = "my-app"

[unknown_section]
foo = "bar"
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
        mode: 'strict',
      })

      // Then
      expect(result.state).toBe('loaded-template')
      if (result.state === 'loaded-template') {
        // Package manager is detected from the environment
        expect(typeof result.packageManager).toBe('string')
      }
    })
  })

  test('defaults to report mode when mode is not specified', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given - a valid config
      const config = `
client_id = "12345"
name = "my-app"
application_url = "https://example.com"
embedded = true

[webhooks]
api_version = "2023-07"

[access_scopes]
scopes = "write_products"

[auth]
redirect_urls = ["https://example.com/callback"]
      `
      await writeFile(joinPath(tmpDir, 'shopify.app.toml'), config)
      await writeFile(joinPath(tmpDir, 'package.json'), '{}')

      // When - mode is not specified
      const result = await loadOpaqueApp({
        directory: tmpDir,
        specifications,
      })

      // Then - should still work (defaults to report mode)
      expect(result.state).toBe('loaded-app')
    })
  })
})
