import {
  Web,
  WebConfigurationSchema,
  App,
  AppInterface,
  WebType,
  getAppScopesArray,
  AppConfigurationInterface,
  CurrentAppConfiguration,
  getAppVersionedSchema,
  AppSchema,
  SchemaForConfig,
  AppLinkedInterface,
} from './app.js'
import {parseStructuredErrors} from './error-parsing.js'
import {
  getAppConfigurationFileName,
  getAppConfigurationShorthand,
  type AppConfigurationFileName,
} from './config-file-naming.js'
import {configurationFileNames, dotEnvFileNames} from '../../constants.js'
import metadata from '../../metadata.js'
import {ExtensionInstance, SpecificationBackedExtension} from '../extensions/extension-instance.js'
import {ExtensionsArraySchema, UnifiedSchema} from '../extensions/schemas.js'
import {ExtensionSpecification, isAppConfigSpecification} from '../extensions/specification.js'
import {CreateAppOptions, Flag} from '../../utilities/developer-platform-client.js'
import {findConfigFiles} from '../../prompts/config.js'
import {WebhookSubscriptionSpecIdentifier} from '../extensions/specifications/app_config_webhook_subscription.js'
import {WebhooksSchema} from '../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {ApplicationURLs, generateApplicationURLs} from '../../services/dev/urls.js'
import {Project} from '../project/project.js'
import {selectActiveConfig} from '../project/active-config.js'
import {
  resolveDotEnv,
  resolveHiddenConfig,
  extensionFilesForConfig,
  webFilesForConfig,
} from '../project/config-selection.js'
import {showMultipleCLIWarningIfNeeded} from '@shopify/cli-kit/node/multiple-installation-warning'
import {fileExists, readFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {TomlFile, TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'
import {zod} from '@shopify/cli-kit/node/schema'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {resolveFramework} from '@shopify/cli-kit/node/framework'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {joinPath, dirname, basename, relativePath, relativizePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputToken, stringifyMessage} from '@shopify/cli-kit/node/output'
import {joinWithAnd} from '@shopify/cli-kit/common/string'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {showNotificationsIfNeeded} from '@shopify/cli-kit/node/notifications-system'
import ignore from 'ignore'
import type {ActiveConfig} from '../project/active-config.js'

/**
 * Narrow runtime state carried forward across app reloads.
 *
 * Replaces passing the entire previous AppInterface — only genuine runtime
 * state (devUUIDs and tunnel URLs) needs to survive a reload.
 */
interface ReloadState {
  /** Extension handle → devUUID, preserved for dev-console stability across reloads */
  extensionDevUUIDs: Map<string, string>
  /** Previous dev tunnel URL, kept stable across reloads */
  previousDevURLs?: ApplicationURLs
}

export interface ConfigurationError {
  file: string
  message: string
  path?: (string | number)[]
  code?: string
}

export function formatConfigurationError(error: ConfigurationError): string {
  if (error.path?.length) {
    return `[${error.path.join('.')}]: ${error.message}`
  }
  return error.message
}

type ConfigurationResult<T> = {data: T; errors?: never} | {data?: never; errors: ConfigurationError[]}

/**
 * Loads a configuration file, validates it against a schema, and returns a result.
 */
export async function parseConfigurationFile<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  preloadedContent?: JsonMapType,
): Promise<ConfigurationResult<zod.TypeOf<TSchema>>> {
  let content = preloadedContent
  if (!content) {
    try {
      const file = await TomlFile.read(filepath)
      content = file.content
    } catch (err) {
      if (err instanceof TomlFileError) {
        return {errors: [{file: filepath, message: err.message}]}
      }
      throw err
    }
  }
  return parseConfigurationObject(schema, filepath, content)
}

/**
 * Parses a configuration object using a schema, and returns a result.
 */
export function parseConfigurationObject<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  configurationObject: unknown,
): ConfigurationResult<zod.TypeOf<TSchema>> {
  const parseResult = schema.safeParse(configurationObject)
  if (!parseResult.success) {
    return {
      errors: parseStructuredErrors(parseResult.error.issues).map((issue) => ({
        file: filepath,
        message: issue.message,
        path: issue.path,
        code: issue.code,
      })),
    }
  }
  return {data: parseResult.data}
}

/**
 * Parses a configuration object using a specification's schema, and returns a result.
 */
export function parseConfigurationObjectAgainstSpecification<TSchema extends zod.ZodType>(
  spec: ExtensionSpecification,
  filepath: string,
  configurationObject: object,
): ConfigurationResult<zod.TypeOf<TSchema>> {
  const parsed = spec.parseConfigurationObject(configurationObject)
  switch (parsed.state) {
    case 'ok': {
      return {data: parsed.data}
    }
    case 'error': {
      return {
        errors: parsed.errors.map((err) => ({
          file: filepath,
          message: err.message ?? 'Unknown error',
          path: err.path,
        })),
      }
    }
  }
}

export class AppErrors {
  private readonly errors: ConfigurationError[] = []

  addError(error: ConfigurationError): void {
    this.errors.push(error)
  }

  addErrors(errors: ConfigurationError[]): void {
    this.errors.push(...errors)
  }

  getErrors(file?: string): ConfigurationError[] {
    if (file) return this.errors.filter((err) => err.file === file)
    return [...this.errors]
  }

  isEmpty(): boolean {
    return this.errors.length === 0
  }
}

interface AppLoaderConstructorArgs<
  TConfig extends CurrentAppConfiguration,
  TModuleSpec extends ExtensionSpecification,
> {
  ignoreUnknownExtensions?: boolean
  loadedConfiguration: ConfigurationLoaderResult<TConfig, TModuleSpec>
  // Pre-discovered project data — avoids re-scanning the filesystem for dependencies, package manager, etc.
  project: Project
  // Narrow runtime state from a previous app load, used during reloads
  reloadState?: ReloadState
}

export async function checkFolderIsValidApp(directory: string) {
  const thereAreConfigFiles = (await findConfigFiles(directory)).length > 0
  if (thereAreConfigFiles) return
  throw new AbortError(
    outputContent`Couldn't find an app toml file at ${outputToken.path(directory)}, is this an app directory?`,
  )
}

export async function loadConfigForAppCreation(directory: string, name: string): Promise<CreateAppOptions> {
  const {project, activeConfig} = await getAppConfigurationContext(directory)
  const rawConfig = activeConfig.file.content
  const webFiles = webFilesForConfig(project, activeConfig.file)
  const webResults = await Promise.all(webFiles.map((wf) => loadSingleWeb(wf.path, wf.content)))
  const webErrors = webResults.flatMap((result) => result.errors ?? [])
  if (webErrors.length > 0) {
    throw new AbortError(webErrors.map(formatConfigurationError).join('\n'))
  }
  const webs = webResults.filter((result): result is {web: Web} => 'web' in result).map((result) => result.web)
  const isLaunchable = webs.some((web) => isWebType(web, WebType.Frontend) || isWebType(web, WebType.Backend))

  const scopesArray = getAppScopesArray(rawConfig as CurrentAppConfiguration)
  const appConfig = rawConfig as CurrentAppConfiguration
  const applicationUrl = appConfig.application_url
  const redirectUrls = appConfig.auth?.redirect_urls
  const staticRoot = appConfig.admin?.static_root

  return {
    isLaunchable,
    scopesArray,
    name,
    directory: project.directory,
    // By default, and ONLY for `app init`, we consider the app as embedded if it is launchable.
    isEmbedded: isLaunchable,
    applicationUrl,
    redirectUrls,
    staticRoot,
  }
}

async function loadSingleWeb(
  webConfigPath: string,
  preloadedContent?: JsonMapType,
): Promise<{web: Web; errors?: never} | {web?: never; errors: ConfigurationError[]}> {
  const result = await parseConfigurationFile(WebConfigurationSchema, webConfigPath, preloadedContent)
  if (result.errors) return {errors: result.errors}
  const config = result.data
  const roles = new Set('roles' in config ? config.roles : [])
  if ('type' in config) roles.add(config.type)
  const {type, ...processedWebConfiguration} = {...config, roles: Array.from(roles), type: undefined}
  return {
    web: {
      directory: dirname(webConfigPath),
      configuration: processedWebConfiguration,
      framework: await resolveFramework(dirname(webConfigPath)),
    },
  }
}

/**
 * Load the local app from the given directory and using the provided extensions/functions specifications.
 * The loader always collects errors. Callers decide whether to throw based on app.errors.
 */
export async function loadApp<TModuleSpec extends ExtensionSpecification = ExtensionSpecification>(options: {
  directory: string
  userProvidedConfigName: string | undefined
  specifications: TModuleSpec[]
  remoteFlags?: Flag[]
  ignoreUnknownExtensions?: boolean
  skipPrompts?: boolean
}): Promise<AppInterface<CurrentAppConfiguration, TModuleSpec>> {
  const {project, activeConfig} = await getAppConfigurationContext(
    options.directory,
    options.userProvidedConfigName,
    options.skipPrompts ? {skipPrompts: true} : undefined,
  )
  return loadAppFromContext({
    project,
    activeConfig,
    specifications: options.specifications,
    remoteFlags: options.remoteFlags,
    ignoreUnknownExtensions: options.ignoreUnknownExtensions,
  })
}

/**
 * Load an app from a pre-resolved Project and ActiveConfig.
 *
 * Use this when you already have a Project (e.g. from getAppConfigurationContext)
 * instead of re-discovering from directory + configName.
 */
export async function loadAppFromContext<TModuleSpec extends ExtensionSpecification = ExtensionSpecification>(options: {
  project: Project
  activeConfig: ActiveConfig
  specifications: TModuleSpec[]
  remoteFlags?: Flag[]
  ignoreUnknownExtensions?: boolean
  reloadState?: ReloadState
  clientIdOverride?: string
}): Promise<AppInterface<CurrentAppConfiguration, TModuleSpec>> {
  const {
    project,
    activeConfig,
    specifications,
    remoteFlags = [],
    ignoreUnknownExtensions,
    reloadState,
    clientIdOverride,
  } = options

  const rawConfig: JsonMapType = {...activeConfig.file.content}
  if (clientIdOverride) {
    rawConfig.client_id = clientIdOverride
  }

  const appVersionedSchema = getAppVersionedSchema(specifications)
  const configSchema = appVersionedSchema as SchemaForConfig<CurrentAppConfiguration>
  const configurationPath = activeConfig.file.path
  const configurationFileName = basename(configurationPath) as AppConfigurationFileName

  const configResult = await parseConfigurationFile(configSchema, configurationPath, rawConfig)
  if (configResult.errors) {
    const formatted = configResult.errors.map(formatConfigurationError).join('\n')
    throw new AbortError(`Validation errors in ${configurationPath}:\n\n${formatted}`)
  }
  const configuration = configResult.data

  const allClientIdsByConfigName = getAllLinkedConfigClientIds(project.appConfigFiles, {
    [configurationFileName]: configuration.client_id,
  })

  let gitTracked = false
  try {
    gitTracked = await checkIfGitTracked(project.directory, configurationPath)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // leave as false
  }

  const configurationLoadResultMetadata: ConfigurationLoadResultMetadata = {
    allClientIdsByConfigName,
    usesLinkedConfig: true,
    name: configurationFileName,
    gitTracked,
    source: activeConfig.source,
    usesCliManagedUrls: configuration.build?.automatically_update_urls_on_dev,
  }

  const loadedConfiguration: ConfigurationLoaderResult<CurrentAppConfiguration, TModuleSpec> = {
    directory: project.directory,
    configPath: configurationPath,
    configuration,
    configurationLoadResultMetadata,
    configSchema,
    specifications,
    remoteFlags,
  }

  const loader = new AppLoader<CurrentAppConfiguration, TModuleSpec>({
    ignoreUnknownExtensions,
    loadedConfiguration,
    project,
    reloadState,
  })
  return loader.loaded()
}

/**
 * Result of loading an app with relaxed validation.
 * Used when we need to load app configuration even if it doesn't fully validate,
 * such as during linking where templates may have extra configuration keys
 * (metafields, metaobjects, etc.).
 */
type OpaqueAppLoadResult =
  | {
      state: 'loaded-app'
      app: AppInterface
      configuration: CurrentAppConfiguration
      packageManager: PackageManager
    }
  | {
      state: 'loaded-template'
      rawConfig: JsonMapType
      scopes: string
      appDirectory: string
      packageManager: PackageManager
    }
  | {
      state: 'error'
    }

/**
 * Extract scopes from raw config using access_scopes.scopes format.
 */
function extractScopesFromRawConfig(rawConfig: JsonMapType): string {
  const accessScopes = rawConfig.access_scopes as {scopes?: string} | undefined
  return accessScopes?.scopes ?? ''
}

/**
 * Load an app with relaxed validation, falling back to raw template loading if strict parsing fails.
 *
 * This is useful for flows like linking where templates may contain extra configuration keys
 * (e.g., metafields, metaobjects) that don't fit the standard schemas but should be preserved.
 *
 * @param options - Options for loading the app
 * @returns A discriminated union representing the load result:
 *   - 'loaded-app': Successfully loaded as a full AppInterface
 *   - 'loaded-template': Loaded as raw template config (validation failed but file is readable)
 *   - 'error': Failed to load entirely
 */
export async function loadOpaqueApp(options: {
  directory: string
  configName?: string
  specifications: ExtensionSpecification[]
  remoteFlags?: Flag[]
  skipPrompts?: boolean
}): Promise<OpaqueAppLoadResult> {
  // Try to load the app normally first — the loader always collects validation errors,
  // so only structural failures (TOML parse, missing files) will throw.
  try {
    const {project, activeConfig} = await getAppConfigurationContext(
      options.directory,
      options.configName,
      options.skipPrompts ? {skipPrompts: true} : undefined,
    )
    const app = await loadAppFromContext({
      project,
      activeConfig,
      specifications: options.specifications,
      remoteFlags: options.remoteFlags,
    })
    return {state: 'loaded-app', app, configuration: app.configuration, packageManager: project.packageManager}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // loadApp failed - try loading as raw template config
    try {
      const project = await Project.load(options.directory)
      const {configurationPath} = await getConfigurationPath(project.directory, options.configName)
      const tomlFile = await TomlFile.read(configurationPath)
      const rawConfig = tomlFile.content

      return {
        state: 'loaded-template',
        rawConfig,
        scopes: extractScopesFromRawConfig(rawConfig),
        appDirectory: project.directory,
        packageManager: project.packageManager,
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // Both attempts failed
      return {state: 'error'}
    }
  }
}

export async function reloadApp(app: AppLinkedInterface): Promise<AppLinkedInterface> {
  const {project, activeConfig} = await getAppConfigurationContext(app.directory, basename(app.configPath))
  const reloadState: ReloadState = {
    extensionDevUUIDs: new Map(app.allExtensions.map((ext) => [ext.handle, ext.devUUID])),
    previousDevURLs: app.devApplicationURLs,
  }
  const newApp = await loadAppFromContext({
    project,
    activeConfig,
    specifications: app.specifications,
    remoteFlags: app.remoteFlags ?? [],
    reloadState,
  })
  if (!newApp.errors.isEmpty()) {
    const errors = newApp.errors.getErrors()
    throw new AbortError(
      outputContent`${outputToken.errorText('Validation errors')}:\n\n${errors.map(formatConfigurationError).join('\n')}`,
    )
  }
  return newApp
}

export function getDotEnvFileName(configurationPath: string) {
  const configurationShorthand: string | undefined = getAppConfigurationShorthand(configurationPath)
  return configurationShorthand ? `${dotEnvFileNames.production}.${configurationShorthand}` : dotEnvFileNames.production
}

class AppLoader<TConfig extends CurrentAppConfiguration, TModuleSpec extends ExtensionSpecification> {
  private readonly ignoreUnknownExtensions: boolean
  private readonly errors: AppErrors = new AppErrors()
  private readonly specifications: TModuleSpec[]
  private readonly remoteFlags: Flag[]
  private readonly loadedConfiguration: ConfigurationLoaderResult<TConfig, TModuleSpec>
  private readonly reloadState: ReloadState | undefined
  private readonly project: Project

  constructor({
    ignoreUnknownExtensions,
    loadedConfiguration,
    reloadState,
    project,
  }: AppLoaderConstructorArgs<TConfig, TModuleSpec>) {
    this.ignoreUnknownExtensions = ignoreUnknownExtensions ?? false
    this.specifications = loadedConfiguration.specifications
    this.remoteFlags = loadedConfiguration.remoteFlags
    this.loadedConfiguration = loadedConfiguration
    this.reloadState = reloadState
    this.project = project
  }

  private get activeConfigFile(): TomlFile | undefined {
    const configPath = this.loadedConfiguration.configPath
    return this.project.appConfigFiles.find((file) => file.path === configPath)
  }

  async loaded() {
    const {configuration, directory, configPath, configurationLoadResultMetadata, configSchema} =
      this.loadedConfiguration

    await logMetadataFromAppLoadingProcess(configurationLoadResultMetadata)

    const dotenv = resolveDotEnv(this.project, configPath)

    const extensions = await this.loadExtensions(directory, configuration)

    const configName = configuration.name
    const configHandle: string | undefined = configuration.handle
    const name: string = configHandle ?? configName ?? ''

    const hiddenConfig = await resolveHiddenConfig(this.project, configuration.client_id)

    if (!this.reloadState) {
      await showMultipleCLIWarningIfNeeded(directory, this.project.nodeDependencies)
    }

    const {webs, usedCustomLayout: usedCustomLayoutForWeb} = await this.loadWebs(
      directory,
      configuration.web_directories,
    )

    const appClass = new App({
      name,
      directory,
      configPath,
      configuration,
      webs,
      modules: extensions,
      dotenv,
      errors: this.errors,
      specifications: this.specifications,
      configSchema,
      remoteFlags: this.remoteFlags,
      hiddenConfig,
      devApplicationURLs: this.getDevApplicationURLs(configuration, webs),
    })

    // Show CLI notifications that are targetted for when your app has specific extension types
    const extensionTypes = appClass.realExtensions.map((module) => module.type)
    await showNotificationsIfNeeded(extensionTypes)

    await logMetadataForLoadedApp(appClass, this.project.usesWorkspaces, {
      usedCustomLayoutForWeb,
      usedCustomLayoutForExtensions: configuration.extension_directories !== undefined,
    })

    await appClass.generateExtensionTypes()

    return appClass
  }

  async loadWebs(appDirectory: string, webDirectories?: string[]): Promise<{webs: Web[]; usedCustomLayout: boolean}> {
    const activeConfig = this.activeConfigFile
    const webFiles = activeConfig ? webFilesForConfig(this.project, activeConfig) : this.project.webConfigFiles
    const webTomlPaths = webFiles.map((file) => file.path)
    const webResults = await Promise.all(webFiles.map((webFile) => loadSingleWeb(webFile.path, webFile.content)))
    const webs: Web[] = []
    for (const result of webResults) {
      if (result.errors) {
        this.errors.addErrors(result.errors)
      } else {
        webs.push(result.web)
      }
    }
    this.validateWebs(webs)

    const allWebsUnderStandardDir = webTomlPaths.every((webPath) => {
      const rel = relativePath(appDirectory, webPath)
      return rel.startsWith('web/')
    })
    const usedCustomLayout = webDirectories !== undefined || !allWebsUnderStandardDir

    return {webs, usedCustomLayout}
  }

  private findSpecificationForType(type: string) {
    return this.specifications.find(
      (spec) =>
        spec.identifier === type || spec.externalIdentifier === type || spec.additionalIdentifiers?.includes(type),
    )
  }

  private validateWebs(webs: Web[]): void {
    ;[WebType.Backend, WebType.Frontend].forEach((webType) => {
      const websOfType = webs.filter((web) => web.configuration.roles.includes(webType))
      if (websOfType.length > 1) {
        const conflictingPaths = websOfType.map((web) => joinPath(web.directory, configurationFileNames.web))
        const pathsList = conflictingPaths.map((path) => `  ${path}`).join('\n')

        const lastConflictingPath = conflictingPaths[conflictingPaths.length - 1]!
        this.errors.addError({
          file: lastConflictingPath,
          message: `You can only have one "web" configuration file with the ${webType} role in your app.\n\nConflicting configurations found at:\n${pathsList}`,
        })
      }
    })
  }

  private async createExtensionInstance(
    type: string,
    configurationObject: object,
    configurationPath: string,
    directory: string,
  ): Promise<ExtensionInstance | undefined> {
    const specification = this.findSpecificationForType(type)
    let entryPath
    let usedKnownSpecification = false

    if (specification) {
      usedKnownSpecification = true
    } else if (this.ignoreUnknownExtensions) {
      return undefined
    } else {
      this.errors.addError({
        file: configurationPath,
        message: `Invalid extension type "${type}" in "${relativizePath(configurationPath)}"`,
      })
      return undefined
    }

    const specResult = parseConfigurationObjectAgainstSpecification(
      specification,
      configurationPath,
      configurationObject,
    )
    if (specResult.errors) {
      this.errors.addErrors(specResult.errors)
      return undefined
    }
    const configuration = specResult.data

    if (usedKnownSpecification) {
      entryPath = await this.findEntryPath(directory, specification)
    }

    const extensionInstance = new SpecificationBackedExtension({
      configuration,
      configurationPath,
      entryPath,
      directory,
      specification,
    })

    if (this.reloadState && configuration.handle) {
      const previousDevUUID = this.reloadState.extensionDevUUIDs.get(configuration.handle)
      if (previousDevUUID) {
        extensionInstance.devUUID = previousDevUUID
      }
    }

    if (usedKnownSpecification) {
      const validateResult = await extensionInstance.validate()
      if (validateResult.isErr()) {
        this.errors.addError({file: configurationPath, message: stringifyMessage(validateResult.error).trim()})
      }
    }
    return extensionInstance
  }

  private async loadExtensions(appDirectory: string, appConfiguration: TConfig): Promise<ExtensionInstance[]> {
    if (this.specifications.length === 0) return []

    const extensionPromises = await this.createExtensionInstances(appDirectory)
    const configExtensionPromises = await this.createConfigExtensionInstances(appDirectory, appConfiguration)

    const webhookPromises = this.createWebhookSubscriptionInstances(appDirectory, appConfiguration)

    const extensions = await Promise.all([...extensionPromises, ...configExtensionPromises, ...webhookPromises])

    const allExtensions = getArrayRejectingUndefined(extensions.flat())

    // Validate that all extensions have a unique handle.
    const handles = new Set()
    allExtensions.forEach((extension) => {
      if (extension.handle && handles.has(extension.handle)) {
        const matchingExtensions = allExtensions.filter((ext) => ext.handle === extension.handle)
        const result = joinWithAnd(matchingExtensions.map((ext) => ext.name))
        this.errors.addError({
          file: extension.configurationPath,
          message: `Duplicated handle "${extension.handle}" in extensions ${result}. Handle needs to be unique per extension.`,
        })
      } else if (extension.handle) {
        handles.add(extension.handle)
      }
    })

    return allExtensions
  }

  private async createExtensionInstances(appDirectory: string) {
    // Use pre-discovered extension files from Project, filtered by active config
    const activeConfig = this.activeConfigFile
    const extensionFiles = activeConfig
      ? extensionFilesForConfig(this.project, activeConfig)
      : this.project.extensionConfigFiles

    return extensionFiles.map(async (extensionFile) => {
      const configurationPath = extensionFile.path
      const directory = dirname(configurationPath)
      const obj = extensionFile.content
      const parseResult = ExtensionsArraySchema.safeParse(obj)
      if (!parseResult.success) {
        this.errors.addError({
          file: configurationPath,
          message: `Invalid extension configuration at ${relativePath(appDirectory, configurationPath)}`,
        })
        return []
      }
      const {extensions, type} = parseResult.data

      if (extensions) {
        // If the extension is an array, it's a unified toml file.
        // Parse all extensions by merging each extension config with the global unified configuration.
        const unifiedResult = await parseConfigurationFile(UnifiedSchema, configurationPath, extensionFile.content)
        if (unifiedResult.errors) {
          this.errors.addErrors(unifiedResult.errors)
          return []
        }
        const configuration = unifiedResult.data
        const extensionsInstancesPromises = configuration.extensions.map(async (extensionConfig) => {
          const mergedConfig = {...configuration, ...extensionConfig}

          if (!mergedConfig.handle) {
            this.errors.addError({
              file: configurationPath,
              message: `Missing handle for extension "${mergedConfig.name}" at ${relativePath(appDirectory, configurationPath)}`,
            })
            mergedConfig.handle = 'unknown-handle'
          }
          return this.createExtensionInstance(mergedConfig.type, mergedConfig, configurationPath, directory)
        })
        return Promise.all(extensionsInstancesPromises)
      } else if (type) {
        return this.createExtensionInstance(type, obj, configurationPath, directory)
      } else {
        this.errors.addError({
          file: configurationPath,
          message: `Invalid extension type at "${relativePath(appDirectory, configurationPath)}". Please specify a type.`,
        })
        return undefined
      }
    })
  }

  private createWebhookSubscriptionInstances(directory: string, appConfiguration: TConfig) {
    const configPath = this.loadedConfiguration.configPath
    const specification = this.findSpecificationForType(WebhookSubscriptionSpecIdentifier)
    if (!specification) return []
    const webhookResult = parseConfigurationObject(WebhooksSchema, configPath, appConfiguration)
    if (webhookResult.errors) {
      this.errors.addErrors(webhookResult.errors)
      return []
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {api_version, subscriptions = []} = webhookResult.data.webhooks
    // Find all unique subscriptions
    const webhookSubscriptions = getArrayRejectingUndefined(
      subscriptions.flatMap((subscription) => {
        // compliance_topics gets handled by privacy_compliance_webhooks
        const {uri, topics, compliance_topics: _, ...optionalFields} = subscription
        return topics?.map((topic) => {
          return {api_version, uri, topic, ...optionalFields}
        })
      }),
    )

    // Create 1 extension instance per subscription
    const instances = webhookSubscriptions.map(async (subscription) => {
      return this.createExtensionInstance(specification.identifier, subscription, configPath, directory)
    })

    return instances
  }

  private async createConfigExtensionInstances(directory: string, appConfiguration: TConfig) {
    const configPath = this.loadedConfiguration.configPath
    const extensionInstancesWithKeys = await Promise.all(
      this.specifications
        .filter((specification) => isAppConfigSpecification(specification))
        .filter((specification) => specification.identifier !== WebhookSubscriptionSpecIdentifier)
        .map(async (specification) => {
          const specResult = parseConfigurationObjectAgainstSpecification(specification, configPath, appConfiguration)
          if (specResult.errors) {
            this.errors.addErrors(specResult.errors)
            return [null, [] as string[]] as const
          }
          const specConfiguration = specResult.data

          if (Object.keys(specConfiguration).length === 0) return [null, Object.keys(specConfiguration)] as const

          const instance = await this.createExtensionInstance(
            specification.identifier,
            specConfiguration,
            configPath,
            directory,
          ).then((extensionInstance) =>
            this.validateConfigurationExtensionInstance(
              appConfiguration.client_id,
              appConfiguration,
              extensionInstance,
            ),
          )
          return [instance, Object.keys(specConfiguration)] as const
        }),
    )

    // get all the keys from appConfiguration that aren't used by any of the results

    const unusedKeys = Object.keys(appConfiguration)
      .filter((key) => !extensionInstancesWithKeys.some(([_, keys]) => keys.includes(key)))
      .filter((key) => {
        const configKeysThatAreNeverModules = [...Object.keys(AppSchema.shape), 'organization_id']
        return !configKeysThatAreNeverModules.includes(key)
      })

    if (unusedKeys.length > 0 && !this.ignoreUnknownExtensions) {
      this.errors.addError({
        file: configPath,
        message: `Unsupported section(s) in app configuration: ${unusedKeys.sort().join(', ')}`,
      })
    }
    return extensionInstancesWithKeys
      .filter(([instance]) => instance)
      .map(([instance]) => instance as ExtensionInstance)
  }

  private async validateConfigurationExtensionInstance(
    apiKey: string,
    appConfiguration: TConfig,
    extensionInstance?: ExtensionInstance,
  ) {
    if (!extensionInstance) return

    const configContent = await extensionInstance.deployConfig({apiKey, appConfiguration})
    return configContent ? extensionInstance : undefined
  }

  private async findEntryPath(directory: string, specification: ExtensionSpecification) {
    let entryPath
    if (specification.appModuleFeatures().includes('single_js_entry_path')) {
      entryPath = (
        await Promise.all(
          ['index']
            .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
            .flatMap((fileName) => [`src/${fileName}`, fileName])
            .map((relativePath) => joinPath(directory, relativePath))
            .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
        )
      ).find((sourcePath) => sourcePath !== undefined)
      if (!entryPath) {
        this.errors.addError({
          file: directory,
          message: `Couldn't find an index.{js,jsx,ts,tsx} file in the directories ${directory} or ${joinPath(directory, 'src')}`,
        })
      }
    } else if (specification.identifier === 'function') {
      entryPath = (
        await Promise.all(
          ['src/index.js', 'src/index.ts', 'src/main.rs']
            .map((relativePath) => joinPath(directory, relativePath))
            .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
        )
      ).find((sourcePath) => sourcePath !== undefined)
    }
    return entryPath
  }

  private getDevApplicationURLs(currentConfiguration: TConfig, webs: Web[]): ApplicationURLs | undefined {
    const previousDevUrls = this.reloadState?.previousDevURLs
    if (!previousDevUrls) return previousDevUrls

    return generateApplicationURLs(
      previousDevUrls.applicationUrl,
      webs.map(({configuration}) => configuration.auth_callback_path).find((path) => path),
      currentConfiguration.app_proxy,
    )
  }
}

type LinkedConfigurationSource =
  // Config file was passed via a flag to a command
  | 'flag'
  // Config file came from the cache (i.e. app use)
  | 'cached'
  // No flag or cache — fell through to the default (shopify.app.toml)
  | 'default'

type ConfigurationLoadResultMetadata = {
  allClientIdsByConfigName: {[key: string]: string}
} & (
  | {
      usesLinkedConfig: false
    }
  | {
      usesLinkedConfig: true
      name: string
      gitTracked: boolean
      source: LinkedConfigurationSource
      usesCliManagedUrls?: boolean
    }
)

type ConfigurationLoaderResult<
  TConfig extends CurrentAppConfiguration,
  TModuleSpec extends ExtensionSpecification,
> = AppConfigurationInterface<TConfig, TModuleSpec> & {
  configurationLoadResultMetadata: ConfigurationLoadResultMetadata
}

/**
 * Get the app configuration context from the file system.
 *
 * Discovers the project and selects the active config. That's it — no parsing
 * or intermediate state construction. Callers that need a parsed config should
 * use `loadAppFromContext`.
 *
 * @param workingDirectory - Typically either the CWD or came from the `--path` argument. The function will find the root folder of the app.
 * @param userProvidedConfigName - Some commands allow the manual specification of the config name to use. Otherwise, the function may prompt/use the cached preference.
 * @returns The project and active config selection.
 */
export async function getAppConfigurationContext(
  workingDirectory: string,
  userProvidedConfigName?: string,
  options?: {skipPrompts?: boolean},
): Promise<{project: Project; activeConfig: ActiveConfig}> {
  const project = await Project.load(workingDirectory)
  const activeConfig = await selectActiveConfig(project, userProvidedConfigName, options)
  return {project, activeConfig}
}

async function checkIfGitTracked(appDirectory: string, configurationPath: string) {
  const gitIgnorePath = joinPath(appDirectory, '.gitignore')
  if (!fileExistsSync(gitIgnorePath)) return true
  const gitIgnoreContent = await readFile(gitIgnorePath)
  const ignored = ignore.default().add(gitIgnoreContent)
  const relative = relativePath(appDirectory, configurationPath)
  const isTracked = !ignored.ignores(relative)
  return isTracked
}

async function getConfigurationPath(appDirectory: string, configName: string | undefined) {
  const configurationFileName = getAppConfigurationFileName(configName)
  const configurationPath = joinPath(appDirectory, configurationFileName)

  if (await fileExists(configurationPath)) {
    return {configurationPath, configurationFileName}
  } else {
    throw new AbortError(outputContent`Couldn't find ${configurationFileName} in ${outputToken.path(appDirectory)}.`)
  }
}

/**
 * Looks for all likely linked config files in the app folder, parses, and returns a mapping of name to client ID.
 *
 * @param prefetchedConfigs - A mapping of config names to client IDs that have already been fetched from the filesystem.
 */
function getAllLinkedConfigClientIds(
  appConfigFiles: TomlFile[],
  prefetchedConfigs: {[key: string]: string | number | undefined},
): {[key: string]: string} {
  const entries: [string, string][] = appConfigFiles
    .map((tomlFile) => {
      const configName = basename(tomlFile.path)
      if (prefetchedConfigs[configName] !== undefined && typeof prefetchedConfigs[configName] === 'string') {
        return [configName, prefetchedConfigs[configName]] as [string, string]
      }
      const clientId = tomlFile.content.client_id
      if (typeof clientId === 'string' && clientId !== '') {
        return [configName, clientId] as [string, string]
      }
      return undefined
    })
    .filter((entry) => entry !== undefined)
  return Object.fromEntries(entries)
}

async function getProjectType(webs: Web[]): Promise<'node' | 'php' | 'ruby' | 'frontend' | undefined> {
  const backendWebs = webs.filter((web) => isWebType(web, WebType.Backend))
  const frontendWebs = webs.filter((web) => isWebType(web, WebType.Frontend))
  if (backendWebs.length > 1) {
    outputDebug('Unable to decide project type as multiple web backends')
    return
  } else if (backendWebs.length === 0 && frontendWebs.length > 0) {
    return 'frontend'
  } else if (!backendWebs[0]) {
    outputDebug('Unable to decide project type as no web backend')
    return
  }

  const {directory} = backendWebs[0]

  const nodeConfigFile = joinPath(directory, 'package.json')
  const rubyConfigFile = joinPath(directory, 'Gemfile')
  const phpConfigFile = joinPath(directory, 'composer.json')

  if (await fileExists(nodeConfigFile)) {
    return 'node'
  } else if (await fileExists(rubyConfigFile)) {
    return 'ruby'
  } else if (await fileExists(phpConfigFile)) {
    return 'php'
  }
  return undefined
}

export function isWebType(web: Web, type: WebType): boolean {
  return web.configuration.roles.includes(type)
}

async function logMetadataForLoadedApp(
  app: AppInterface,
  usesWorkspaces: boolean,
  loadingStrategy: {
    usedCustomLayoutForWeb: boolean
    usedCustomLayoutForExtensions: boolean
  },
) {
  const webs = app.webs
  const extensionsToAddToMetrics = app.allExtensions.filter((ext) => ext.isSentToMetrics())

  const appName = app.name
  const appDirectory = app.directory
  const sortedAppScopes = getAppScopesArray(app.configuration).sort()

  await logMetadataForLoadedAppUsingRawValues(
    webs,
    extensionsToAddToMetrics,
    loadingStrategy,
    appName,
    appDirectory,
    sortedAppScopes,
    usesWorkspaces,
  )
}

async function logMetadataForLoadedAppUsingRawValues(
  webs: Web[],
  extensionsToAddToMetrics: ExtensionInstance[],
  loadingStrategy: {usedCustomLayoutForWeb: boolean; usedCustomLayoutForExtensions: boolean},
  appName: string,
  appDirectory: string,
  sortedAppScopes: string[],
  appUsesWorkspaces: boolean,
) {
  await metadata.addPublicMetadata(async () => {
    const projectType = await getProjectType(webs)

    const extensionFunctionCount = extensionsToAddToMetrics.filter((extension) => extension.isFunctionExtension).length
    const extensionUICount = extensionsToAddToMetrics.filter((extension) => extension.isESBuildExtension).length
    const extensionThemeCount = extensionsToAddToMetrics.filter((extension) => extension.isThemeExtension).length

    const extensionTotalCount = extensionsToAddToMetrics.length

    const webBackendCount = webs.filter((web) => isWebType(web, WebType.Backend)).length
    const webBackendFramework =
      webBackendCount === 1 ? webs.filter((web) => isWebType(web, WebType.Backend))[0]?.framework : undefined
    const webFrontendCount = webs.filter((web) => isWebType(web, WebType.Frontend)).length

    const extensionsBreakdownMapping: {[key: string]: number} = {}
    for (const extension of extensionsToAddToMetrics) {
      if (extensionsBreakdownMapping[extension.type] === undefined) {
        extensionsBreakdownMapping[extension.type] = 1
      } else {
        extensionsBreakdownMapping[extension.type]!++
      }
    }

    return {
      project_type: projectType,
      app_extensions_any: extensionTotalCount > 0,
      app_extensions_breakdown: JSON.stringify(extensionsBreakdownMapping),
      app_extensions_count: extensionTotalCount,
      app_extensions_custom_layout: loadingStrategy.usedCustomLayoutForExtensions,
      app_extensions_function_any: extensionFunctionCount > 0,
      app_extensions_function_count: extensionFunctionCount,
      app_extensions_theme_any: extensionThemeCount > 0,
      app_extensions_theme_count: extensionThemeCount,
      app_extensions_ui_any: extensionUICount > 0,
      app_extensions_ui_count: extensionUICount,
      app_name_hash: hashString(appName),
      app_path_hash: hashString(appDirectory),
      app_scopes: JSON.stringify(sortedAppScopes),
      app_web_backend_any: webBackendCount > 0,
      app_web_backend_count: webBackendCount,
      app_web_custom_layout: loadingStrategy.usedCustomLayoutForWeb,
      app_web_framework: webBackendFramework,
      app_web_frontend_any: webFrontendCount > 0,
      app_web_frontend_count: webFrontendCount,
      env_package_manager_workspaces: appUsesWorkspaces,
    }
  })

  await metadata.addSensitiveMetadata(async () => {
    return {
      app_name: appName,
    }
  })
}

async function logMetadataFromAppLoadingProcess(loadMetadata: ConfigurationLoadResultMetadata) {
  await metadata.addPublicMetadata(async () => {
    return {
      // Generic config as code instrumentation
      cmd_app_all_configs_any: Object.keys(loadMetadata.allClientIdsByConfigName).length > 0,
      cmd_app_all_configs_clients: JSON.stringify(loadMetadata.allClientIdsByConfigName),
      cmd_app_linked_config_used: loadMetadata.usesLinkedConfig,
      ...(loadMetadata.usesLinkedConfig
        ? {
            cmd_app_linked_config_name: loadMetadata.name,
            cmd_app_linked_config_git_tracked: loadMetadata.gitTracked,
            cmd_app_linked_config_source: loadMetadata.source,
            cmd_app_linked_config_uses_cli_managed_urls: loadMetadata.usesCliManagedUrls,
          }
        : {}),
    }
  })
}

// Re-export config file naming utilities from their leaf module.
// These were moved to break the circular dependency: loader ↔ active-config ↔ use ↔ loader.
export {
  getAppConfigurationFileName,
  getAppConfigurationShorthand,
  isValidFormatAppConfigurationFileName,
  type AppConfigurationFileName,
} from './config-file-naming.js'
