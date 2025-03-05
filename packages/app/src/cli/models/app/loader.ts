import {
  Web,
  WebConfigurationSchema,
  App,
  AppInterface,
  WebType,
  getAppScopesArray,
  AppConfigurationInterface,
  LegacyAppSchema,
  AppConfiguration,
  CurrentAppConfiguration,
  getAppVersionedSchema,
  isCurrentAppSchema,
  AppSchema,
  LegacyAppConfiguration,
  BasicAppConfigurationWithoutModules,
  SchemaForConfig,
  AppLinkedInterface,
  AppHiddenConfig,
} from './app.js'
import {showMultipleCLIWarningIfNeeded} from './validation/multi-cli-warning.js'
import {configurationFileNames, dotEnvFileNames} from '../../constants.js'
import metadata from '../../metadata.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {ExtensionsArraySchema, UnifiedSchema} from '../extensions/schemas.js'
import {ExtensionSpecification, RemoteAwareExtensionSpecification} from '../extensions/specification.js'
import {getCachedAppInfo} from '../../services/local-storage.js'
import use from '../../services/app/config/use.js'
import {CreateAppOptions, Flag} from '../../utilities/developer-platform-client.js'
import {findConfigFiles} from '../../prompts/config.js'
import {WebhookSubscriptionSpecIdentifier} from '../extensions/specifications/app_config_webhook_subscription.js'
import {WebhooksSchema} from '../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {UIExtensionSchemaType} from '../extensions/specifications/ui_extension.js'
import {patchAppHiddenConfigFile} from '../../services/app/patch-app-configuration-file.js'
import {fileExists, readFile, glob, findPathUp, fileExistsSync, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {
  getDependencies,
  getPackageManager,
  getPackageName,
  usesWorkspaces as appUsesWorkspaces,
} from '@shopify/cli-kit/node/node-package-manager'
import {resolveFramework} from '@shopify/cli-kit/node/framework'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {JsonMapType, decodeToml} from '@shopify/cli-kit/node/toml'
import {joinPath, dirname, basename, relativePath, relativizePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, OutputMessage, outputToken} from '@shopify/cli-kit/node/output'
import {joinWithAnd, slugify} from '@shopify/cli-kit/common/string'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {showNotificationsIfNeeded} from '@shopify/cli-kit/node/notifications-system'
import ignore from 'ignore'
import {withHiddenConfigPathIn} from '@shopify/cli-kit/node/hiddenFolder'

const defaultExtensionDirectory = 'extensions/*'

export type AppLoaderMode = 'strict' | 'report'

type AbortOrReport = <T>(errorMessage: OutputMessage, fallback: T, configurationPath: string) => T

const abort: AbortOrReport = (errorMessage) => {
  throw new AbortError(errorMessage)
}

const noopAbortOrReport: AbortOrReport = (_errorMessage, fallback, _configurationPath) => fallback

/**
 * Loads a configuration file, and returns its content as an unvalidated object.
 */
export async function loadConfigurationFileContent(
  filepath: string,
  abortOrReport: AbortOrReport = abort,
  decode: (input: string) => JsonMapType = decodeToml,
): Promise<JsonMapType> {
  if (!(await fileExists(filepath))) {
    return abortOrReport(outputContent`Couldn't find an app toml file at ${outputToken.path(filepath)}`, {}, filepath)
  }

  try {
    const configurationContent = await readFile(filepath)
    return decode(configurationContent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // TOML errors have line, pos and col properties
    if (err.line !== undefined && err.pos !== undefined && err.col !== undefined) {
      return abortOrReport(
        outputContent`Fix the following error in ${outputToken.path(filepath)}:\n${err.message}`,
        {},
        filepath,
      )
    } else {
      throw err
    }
  }
}

/**
 * Loads a configuration file, validates it against a schema, and returns the parsed object.
 *
 * Calls `abortOrReport` if the file is invalid.
 */
export async function parseConfigurationFile<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  abortOrReport: AbortOrReport = abort,
  decode: (input: string) => JsonMapType = decodeToml,
  preloadedContent?: JsonMapType,
): Promise<zod.TypeOf<TSchema> & {path: string}> {
  const fallbackOutput = {} as zod.TypeOf<TSchema>

  const configurationObject = preloadedContent ?? (await loadConfigurationFileContent(filepath, abortOrReport, decode))

  if (!configurationObject) return fallbackOutput

  const configuration = parseConfigurationObject(schema, filepath, configurationObject, abortOrReport)
  return {...configuration, path: filepath}
}

export function parseHumanReadableError(issues: Pick<zod.ZodIssueBase, 'path' | 'message'>[]) {
  let humanReadableError = ''
  issues.forEach((issue) => {
    const path = issue.path ? issue?.path.join('.') : 'n/a'
    humanReadableError += `• [${path}]: ${issue.message}\n`
  })
  return humanReadableError
}

/**
 * Parses a configuration object using a schema, and returns the parsed object, or calls `abortOrReport` if the object is invalid.
 */
export function parseConfigurationObject<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  configurationObject: unknown,
  abortOrReport: AbortOrReport = abort,
): zod.TypeOf<TSchema> {
  const fallbackOutput = {} as zod.TypeOf<TSchema>

  const parseResult = schema.safeParse(configurationObject)
  if (!parseResult.success) {
    return abortOrReport(
      outputContent`\n${outputToken.errorText('Validation errors')} in ${outputToken.path(
        filepath,
      )}:\n\n${parseHumanReadableError(parseResult.error.issues)}`,
      fallbackOutput,
      filepath,
    )
  }
  return parseResult.data
}

/**
 * Parses a configuration object using a schema, and returns the parsed object, or calls `abortOrReport` if the object is invalid.
 */
export function parseConfigurationObjectAgainstSpecification<TSchema extends zod.ZodType>(
  spec: ExtensionSpecification,
  filepath: string,
  configurationObject: object,
  abortOrReport: AbortOrReport,
): zod.TypeOf<TSchema> {
  const parsed = spec.parseConfigurationObject(configurationObject)
  switch (parsed.state) {
    case 'ok': {
      return parsed.data
    }
    case 'error': {
      const fallbackOutput = {} as zod.TypeOf<TSchema>
      return abortOrReport(
        outputContent`App configuration is not valid\nValidation errors in ${outputToken.path(
          filepath,
        )}:\n\n${parseHumanReadableError(parsed.errors)}`,
        fallbackOutput,
        filepath,
      )
    }
  }
}

export class AppErrors {
  private errors: {
    [key: string]: OutputMessage
  } = {}

  addError(path: string, message: OutputMessage): void {
    this.errors[path] = message
  }

  getError(path: string) {
    return this.errors[path]
  }

  isEmpty() {
    return Object.keys(this.errors).length === 0
  }

  toJSON(): OutputMessage[] {
    return Object.values(this.errors)
  }
}

interface AppLoaderConstructorArgs<TConfig extends AppConfiguration, TModuleSpec extends ExtensionSpecification> {
  mode?: AppLoaderMode
  loadedConfiguration: ConfigurationLoaderResult<TConfig, TModuleSpec>
  // Used when reloading an app, to avoid some expensive steps during loading.
  previousApp?: AppLinkedInterface
}

export async function checkFolderIsValidApp(directory: string) {
  const thereAreConfigFiles = (await findConfigFiles(directory)).length > 0
  if (thereAreConfigFiles) return
  throw new AbortError(
    outputContent`Couldn't find an app toml file at ${outputToken.path(directory)}, is this an app directory?`,
  )
}

export async function loadConfigForAppCreation(directory: string, name: string): Promise<CreateAppOptions> {
  const state = await getAppConfigurationState(directory)
  const config: AppConfiguration = state.state === 'connected-app' ? state.basicConfiguration : state.startingOptions
  const loadedConfiguration = await loadAppConfigurationFromState(state, [], [])

  const loader = new AppLoader({loadedConfiguration})
  const webs = await loader.loadWebs(directory)

  const isLaunchable = webs.webs.some((web) => isWebType(web, WebType.Frontend) || isWebType(web, WebType.Backend))

  return {
    isLaunchable,
    scopesArray: getAppScopesArray(config),
    name,
    directory,
    // By default, and ONLY for `app init`, we consider the app as embedded if it is launchable.
    isEmbedded: isLaunchable,
  }
}

/**
 * Load the local app from the given directory and using the provided extensions/functions specifications.
 * If the App contains extensions not supported by the current specs and mode is strict, it will throw an error.
 */
export async function loadApp<TModuleSpec extends ExtensionSpecification = ExtensionSpecification>(
  options: Omit<AppLoaderConstructorArgs<AppConfiguration, ExtensionSpecification>, 'loadedConfiguration'> & {
    directory: string
    userProvidedConfigName: string | undefined
    specifications: TModuleSpec[]
    remoteFlags?: Flag[]
  },
): Promise<AppInterface<AppConfiguration, TModuleSpec>> {
  const specifications = options.specifications

  const state = await getAppConfigurationState(options.directory, options.userProvidedConfigName)
  const loadedConfiguration = await loadAppConfigurationFromState(state, specifications, options.remoteFlags ?? [])

  const loader = new AppLoader<AppConfiguration, TModuleSpec>({
    mode: options.mode,
    loadedConfiguration,
  })
  return loader.loaded()
}

export async function reloadApp(app: AppLinkedInterface): Promise<AppLinkedInterface> {
  const state = await getAppConfigurationState(app.directory, basename(app.configuration.path))
  if (state.state !== 'connected-app') {
    throw new AbortError('Error loading the app, please check your app configuration.')
  }
  const loadedConfiguration = await loadAppConfigurationFromState(state, app.specifications, app.remoteFlags ?? [])

  const loader = new AppLoader({
    loadedConfiguration,
    previousApp: app,
  })

  return loader.loaded()
}

export async function loadAppUsingConfigurationState<TConfig extends AppConfigurationState>(
  configState: TConfig,
  {
    specifications,
    remoteFlags,
    mode,
  }: {
    specifications: RemoteAwareExtensionSpecification[]
    remoteFlags?: Flag[]
    mode: AppLoaderMode
  },
): Promise<AppInterface<LoadedAppConfigFromConfigState<typeof configState>, RemoteAwareExtensionSpecification>> {
  const loadedConfiguration = await loadAppConfigurationFromState(configState, specifications, remoteFlags ?? [])

  const loader = new AppLoader({
    mode,
    loadedConfiguration,
  })
  return loader.loaded()
}

/**
 * Given basic information about an app's configuration state, what should the validated configuration type be?
 */
type LoadedAppConfigFromConfigState<TConfigState> = TConfigState extends AppConfigurationStateLinked
  ? CurrentAppConfiguration
  : LegacyAppConfiguration

export function getDotEnvFileName(configurationPath: string) {
  const configurationShorthand: string | undefined = getAppConfigurationShorthand(configurationPath)
  return configurationShorthand ? `${dotEnvFileNames.production}.${configurationShorthand}` : dotEnvFileNames.production
}

export async function loadDotEnv(appDirectory: string, configurationPath: string): Promise<DotEnvFile | undefined> {
  let dotEnvFile: DotEnvFile | undefined
  const dotEnvPath = joinPath(appDirectory, getDotEnvFileName(configurationPath))
  if (await fileExists(dotEnvPath)) {
    dotEnvFile = await readAndParseDotEnv(dotEnvPath)
  }
  return dotEnvFile
}

class AppLoader<TConfig extends AppConfiguration, TModuleSpec extends ExtensionSpecification> {
  private readonly mode: AppLoaderMode
  private readonly errors: AppErrors = new AppErrors()
  private readonly specifications: TModuleSpec[]
  private readonly remoteFlags: Flag[]
  private readonly loadedConfiguration: ConfigurationLoaderResult<TConfig, TModuleSpec>
  private readonly previousApp: AppLinkedInterface | undefined

  constructor({mode, loadedConfiguration, previousApp}: AppLoaderConstructorArgs<TConfig, TModuleSpec>) {
    this.mode = mode ?? 'strict'
    this.specifications = loadedConfiguration.specifications
    this.remoteFlags = loadedConfiguration.remoteFlags
    this.loadedConfiguration = loadedConfiguration
    this.previousApp = previousApp
  }

  async loaded() {
    const {configuration, directory, configurationLoadResultMetadata, configSchema} = this.loadedConfiguration

    await logMetadataFromAppLoadingProcess(configurationLoadResultMetadata)

    const dotenv = await loadDotEnv(directory, configuration.path)

    const extensions = await this.loadExtensions(directory, configuration)

    const packageJSONPath = joinPath(directory, 'package.json')

    // These don't need to be processed again if the app is being reloaded
    const name = this.previousApp?.name ?? (await loadAppName(directory))
    const nodeDependencies = this.previousApp?.nodeDependencies ?? (await getDependencies(packageJSONPath))
    const packageManager = this.previousApp?.packageManager ?? (await getPackageManager(directory))
    const usesWorkspaces = this.previousApp?.usesWorkspaces ?? (await appUsesWorkspaces(directory))

    const hiddenConfig = await loadHiddenConfig(directory, configuration)

    if (!this.previousApp) {
      await showMultipleCLIWarningIfNeeded(directory, nodeDependencies)
    }

    const {webs, usedCustomLayout: usedCustomLayoutForWeb} = await this.loadWebs(
      directory,
      configuration.web_directories,
    )

    const appClass = new App({
      name,
      directory,
      packageManager,
      configuration,
      nodeDependencies,
      webs,
      modules: extensions,
      usesWorkspaces,
      dotenv,
      specifications: this.specifications,
      configSchema,
      remoteFlags: this.remoteFlags,
      hiddenConfig,
      devApplicationURLs: this.previousApp?.devApplicationURLs,
    })

    // Show CLI notifications that are targetted for when your app has specific extension types
    const extensionTypes = appClass.realExtensions.map((module) => module.type)
    await showNotificationsIfNeeded(extensionTypes)

    if (!this.errors.isEmpty()) appClass.errors = this.errors

    await logMetadataForLoadedApp(appClass, {
      usedCustomLayoutForWeb,
      usedCustomLayoutForExtensions: configuration.extension_directories !== undefined,
    })

    return appClass
  }

  async loadWebs(appDirectory: string, webDirectories?: string[]): Promise<{webs: Web[]; usedCustomLayout: boolean}> {
    const defaultWebDirectory = '**'
    const webConfigGlobs = [...(webDirectories ?? [defaultWebDirectory])].map((webGlob) => {
      return joinPath(appDirectory, webGlob, configurationFileNames.web)
    })
    webConfigGlobs.push(`!${joinPath(appDirectory, '**/node_modules/**')}`)
    const webTomlPaths = await glob(webConfigGlobs)

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))
    this.validateWebs(webs)

    const webTomlsInStandardLocation = await glob(joinPath(appDirectory, `web/**/${configurationFileNames.web}`))
    const usedCustomLayout = webDirectories !== undefined || webTomlsInStandardLocation.length !== webTomlPaths.length

    return {webs, usedCustomLayout}
  }

  private findSpecificationForType(type: string) {
    return this.specifications.find(
      (spec) =>
        spec.identifier === type || spec.externalIdentifier === type || spec.additionalIdentifiers?.includes(type),
    )
  }

  private parseConfigurationFile<TSchema extends zod.ZodType>(
    schema: TSchema,
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = decodeToml,
  ) {
    return parseConfigurationFile(schema, filepath, this.abortOrReport.bind(this), decode)
  }

  private validateWebs(webs: Web[]): void {
    ;[WebType.Backend, WebType.Frontend].forEach((webType) => {
      const websOfType = webs.filter((web) => web.configuration.roles.includes(webType))
      if (websOfType[1]) {
        this.abortOrReport(
          outputContent`You can only have one web with the ${outputToken.yellow(webType)} role in your app`,
          undefined,

          joinPath(websOfType[1].directory, configurationFileNames.web),
        )
      }
    })
  }

  private async loadWeb(WebConfigurationFile: string): Promise<Web> {
    const config = await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile)
    const roles = new Set('roles' in config ? config.roles : [])
    if ('type' in config) roles.add(config.type)
    const {type, ...processedWebConfiguration} = {...config, roles: Array.from(roles), type: undefined}
    return {
      directory: dirname(WebConfigurationFile),
      configuration: processedWebConfiguration,
      framework: await resolveFramework(dirname(WebConfigurationFile)),
    }
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
    } else {
      return this.abortOrReport(
        outputContent`Invalid extension type "${type}" in "${relativizePath(configurationPath)}"`,
        undefined,
        configurationPath,
      )
    }

    const configuration = parseConfigurationObjectAgainstSpecification(
      specification,
      configurationPath,
      configurationObject,
      this.abortOrReport.bind(this),
    )

    if (usedKnownSpecification) {
      entryPath = await this.findEntryPath(directory, specification)
    }

    const previousExtension = this.previousApp?.allExtensions.find((extension) => {
      return extension.handle === configuration.handle
    })

    const extensionInstance = new ExtensionInstance({
      configuration,
      configurationPath,
      entryPath,
      directory,
      specification,
    })

    if (previousExtension) {
      // If we are reloading, keep the existing devUUID for consistency with the dev-console
      extensionInstance.devUUID = previousExtension.devUUID
    }

    if (usedKnownSpecification) {
      const validateResult = await extensionInstance.validate()
      if (validateResult.isErr()) {
        this.abortOrReport(outputContent`\n${validateResult.error}`, undefined, configurationPath)
      }
    }
    return extensionInstance
  }

  private async loadExtensions(appDirectory: string, appConfiguration: TConfig): Promise<ExtensionInstance[]> {
    if (this.specifications.length === 0) return []

    const extensionPromises = await this.createExtensionInstances(appDirectory, appConfiguration.extension_directories)
    const configExtensionPromises = isCurrentAppSchema(appConfiguration)
      ? await this.createConfigExtensionInstances(appDirectory, appConfiguration)
      : []

    const webhookPromises = isCurrentAppSchema(appConfiguration)
      ? this.createWebhookSubscriptionInstances(appDirectory, appConfiguration)
      : []

    const extensions = await Promise.all([...extensionPromises, ...configExtensionPromises, ...webhookPromises])

    const allExtensions = getArrayRejectingUndefined(extensions.flat())

    // Validate that all extensions have a unique handle.
    const handles = new Set()
    allExtensions.forEach((extension) => {
      if (extension.handle && handles.has(extension.handle)) {
        const matchingExtensions = allExtensions.filter((ext) => ext.handle === extension.handle)
        const result = joinWithAnd(matchingExtensions.map((ext) => ext.configuration.name))
        const handle = outputToken.cyan(extension.handle)

        this.abortOrReport(
          outputContent`Duplicated handle "${handle}" in extensions ${result}. Handle needs to be unique per extension.`,
          undefined,
          extension.configurationPath,
        )
      } else if (extension.handle) {
        handles.add(extension.handle)
      }
    })

    // Temporary code to validate that there is a single print action extension per target in an app.
    // Should be replaced by core validation.
    this.validatePrintActionExtensionsUniqueness(allExtensions)

    return allExtensions
  }

  private async createExtensionInstances(appDirectory: string, extensionDirectories?: string[]) {
    const extensionConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].map((extensionPath) => {
      return joinPath(appDirectory, extensionPath, '*.extension.toml')
    })
    extensionConfigPaths.push(`!${joinPath(appDirectory, '**/node_modules/**')}`)
    const configPaths = await glob(extensionConfigPaths)

    return configPaths.map(async (configurationPath) => {
      const directory = dirname(configurationPath)
      const obj = await loadConfigurationFileContent(configurationPath)
      const {extensions, type} = ExtensionsArraySchema.parse(obj)

      if (extensions) {
        // If the extension is an array, it's a unified toml file.
        // Parse all extensions by merging each extension config with the global unified configuration.
        const configuration = await this.parseConfigurationFile(UnifiedSchema, configurationPath)
        const extensionsInstancesPromises = configuration.extensions.map(async (extensionConfig) => {
          const mergedConfig = {...configuration, ...extensionConfig}

          // Remove `extensions` and `path`, they are injected automatically but not needed nor expected by the contract
          if (!mergedConfig.handle) {
            // Handle is required for unified config extensions.
            this.abortOrReport(
              outputContent`Missing handle for extension "${mergedConfig.name}" at ${relativePath(
                appDirectory,
                configurationPath,
              )}`,
              undefined,
              configurationPath,
            )
            mergedConfig.handle = 'unknown-handle'
          }
          return this.createExtensionInstance(mergedConfig.type, mergedConfig, configurationPath, directory)
        })
        return Promise.all(extensionsInstancesPromises)
      } else if (type) {
        // Legacy toml file with a single extension.
        return this.createExtensionInstance(type, obj, configurationPath, directory)
      } else {
        return this.abortOrReport(
          outputContent`Invalid extension type at "${outputToken.path(
            relativePath(appDirectory, configurationPath),
          )}". Please specify a type.`,
          undefined,
          configurationPath,
        )
      }
    })
  }

  private createWebhookSubscriptionInstances(directory: string, appConfiguration: TConfig) {
    const specification = this.findSpecificationForType(WebhookSubscriptionSpecIdentifier)
    if (!specification) return []
    const specConfiguration = parseConfigurationObject(
      WebhooksSchema,
      appConfiguration.path,
      appConfiguration,
      this.abortOrReport.bind(this),
    )
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {api_version, subscriptions = []} = specConfiguration.webhooks
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
      return this.createExtensionInstance(specification.identifier, subscription, appConfiguration.path, directory)
    })

    return instances
  }

  private async createConfigExtensionInstances(directory: string, appConfiguration: TConfig & CurrentAppConfiguration) {
    const extensionInstancesWithKeys = await Promise.all(
      this.specifications
        .filter((specification) => specification.uidStrategy === 'single')
        .map(async (specification) => {
          const specConfiguration = parseConfigurationObjectAgainstSpecification(
            specification,
            appConfiguration.path,
            appConfiguration,
            this.abortOrReport.bind(this),
          )

          if (Object.keys(specConfiguration).length === 0) return [null, Object.keys(specConfiguration)] as const

          const instance = await this.createExtensionInstance(
            specification.identifier,
            specConfiguration,
            appConfiguration.path,
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
        const configKeysThatAreNeverModules = [...Object.keys(AppSchema.shape), 'path']
        return !configKeysThatAreNeverModules.includes(key)
      })

    if (unusedKeys.length > 0) {
      outputDebug(outputContent`Unused keys in app configuration: ${outputToken.json(unusedKeys)}`)
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
        this.abortOrReport(
          outputContent`Couldn't find an index.{js,jsx,ts,tsx} file in the directories ${outputToken.path(
            directory,
          )} or ${outputToken.path(joinPath(directory, 'src'))}`,
          undefined,
          directory,
        )
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

  private abortOrReport<T>(errorMessage: OutputMessage, fallback: T, configurationPath: string): T {
    if (this.mode === 'strict') {
      throw new AbortError(errorMessage)
    } else {
      this.errors.addError(configurationPath, errorMessage)
      return fallback
    }
  }

  private validatePrintActionExtensionsUniqueness(allExtensions: ExtensionInstance[]) {
    const duplicates: {[key: string]: ExtensionInstance[]} = {}

    allExtensions
      .filter((ext) => ext.type === 'ui_extension')
      .forEach((extension) => {
        const points = extension.configuration.extension_points as UIExtensionSchemaType['extension_points']
        const targets = points.flatMap((point) => point.target).filter((target) => printTargets.includes(target))
        targets.forEach((target) => {
          const targetExtensions = duplicates[target] ?? []
          targetExtensions.push(extension)
          duplicates[target] = targetExtensions

          if (targetExtensions.length > 1) {
            const extensionHandles = ['', ...targetExtensions.map((ext) => ext.configuration.handle)].join('\n  · ')
            this.abortOrReport(
              outputContent`A single target can't support two print action extensions from the same app. Point your extensions at different targets, or remove an extension.\n\nThe following extensions both target ${target}:${extensionHandles}`,
              undefined,
              extension.configurationPath,
            )
          }
        })
      })
  }
}

/**
 * Parse the app configuration file from the given directory. This doesn't load any extensions.
 * If the app configuration does not match any known schemas, it will throw an error.
 */
export async function loadAppConfiguration(
  options: AppConfigurationLoaderConstructorArgs,
): Promise<AppConfigurationInterface> {
  const specifications = options.specifications ?? (await loadLocalExtensionsSpecifications())
  const state = await getAppConfigurationState(options.directory, options.userProvidedConfigName)
  const result = await loadAppConfigurationFromState(state, specifications, options.remoteFlags ?? [])
  await logMetadataFromAppLoadingProcess(result.configurationLoadResultMetadata)
  return result
}

interface AppConfigurationLoaderConstructorArgs {
  directory: string
  userProvidedConfigName: string | undefined
  specifications?: ExtensionSpecification[]
  remoteFlags?: Flag[]
}

type LinkedConfigurationSource =
  // Config file was passed via a flag to a command
  | 'flag'
  // Config file came from the cache (i.e. app use)
  | 'cached'

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
  TConfig extends AppConfiguration,
  TModuleSpec extends ExtensionSpecification,
> = AppConfigurationInterface<TConfig, TModuleSpec> & {
  configurationLoadResultMetadata: ConfigurationLoadResultMetadata
}

interface AppConfigurationStateBasics {
  appDirectory: string
  configurationPath: string
  configSource: LinkedConfigurationSource
  configurationFileName: AppConfigurationFileName
}

export type AppConfigurationStateLinked = AppConfigurationStateBasics & {
  state: 'connected-app'
  basicConfiguration: BasicAppConfigurationWithoutModules
}

type AppConfigurationStateTemplate = AppConfigurationStateBasics & {
  state: 'template-only'
  startingOptions: Omit<LegacyAppConfiguration, 'client_id'>
}

type AppConfigurationState = AppConfigurationStateLinked | AppConfigurationStateTemplate

/**
 * Get the app configuration state from the file system.
 *
 * This takes a shallow look at the app folder, and indicates if the app has been linked or is still in template form.
 *
 * @param workingDirectory - Typically either the CWD or came from the `--path` argument. The function will find the root folder of the app.
 * @param userProvidedConfigName - Some commands allow the manual specification of the config name to use. Otherwise, the function may prompt/use the cached preference.
 * @returns Detail about the app configuration state.
 */
export async function getAppConfigurationState(
  workingDirectory: string,
  userProvidedConfigName?: string,
): Promise<AppConfigurationState> {
  // partially loads the app config. doesn't actually check for config validity beyond the absolute minimum
  let configName = userProvidedConfigName

  const appDirectory = await getAppDirectory(workingDirectory)
  const configSource: LinkedConfigurationSource = configName ? 'flag' : 'cached'

  const cachedCurrentConfigName = getCachedAppInfo(appDirectory)?.configFile
  const cachedCurrentConfigPath = cachedCurrentConfigName ? joinPath(appDirectory, cachedCurrentConfigName) : null
  if (!configName && cachedCurrentConfigPath && !fileExistsSync(cachedCurrentConfigPath)) {
    const warningContent = {
      headline: `Couldn't find ${cachedCurrentConfigName}`,
      body: [
        "If you have multiple config files, select a new one. If you only have one config file, it's been selected as your default.",
      ],
    }
    configName = await use({directory: appDirectory, warningContent, shouldRenderSuccess: false})
  }

  configName = configName ?? cachedCurrentConfigName

  const {configurationPath, configurationFileName} = await getConfigurationPath(appDirectory, configName)
  const file = await loadConfigurationFileContent(configurationPath)

  const configFileHasBeenLinked = isCurrentAppSchema(file as AppConfiguration)

  if (configFileHasBeenLinked) {
    const parsedConfig = await parseConfigurationFile(AppSchema, configurationPath)
    return {
      state: 'connected-app',
      appDirectory,
      configurationPath,
      basicConfiguration: {
        ...file,
        ...parsedConfig,
      },
      configSource,
      configurationFileName,
    }
  } else {
    const parsedConfig = await parseConfigurationFile(LegacyAppSchema, configurationPath)
    return {
      appDirectory,
      configurationPath,
      state: 'template-only',
      startingOptions: {
        ...file,
        ...parsedConfig,
      },
      configSource,
      configurationFileName,
    }
  }
}

/**
 * Given app configuration state, load the app configuration.
 *
 * This is typically called after getting remote-aware extension specifications. The app configuration is validated acordingly.
 */
async function loadAppConfigurationFromState<
  TConfig extends AppConfigurationState,
  TModuleSpec extends ExtensionSpecification,
>(
  configState: TConfig,
  specifications: TModuleSpec[],
  remoteFlags: Flag[],
): Promise<ConfigurationLoaderResult<LoadedAppConfigFromConfigState<TConfig>, TModuleSpec>> {
  let file: JsonMapType
  let schemaForConfigurationFile: SchemaForConfig<LoadedAppConfigFromConfigState<TConfig>>
  {
    let appSchema
    switch (configState.state) {
      case 'template-only': {
        file = {
          ...configState.startingOptions,
        }
        delete file.path
        appSchema = LegacyAppSchema as unknown as SchemaForConfig<LoadedAppConfigFromConfigState<TConfig>>
        break
      }
      case 'connected-app': {
        file = {
          ...configState.basicConfiguration,
        }
        delete file.path
        const appVersionedSchema = getAppVersionedSchema(specifications)
        appSchema = appVersionedSchema as SchemaForConfig<LoadedAppConfigFromConfigState<TConfig>>
        break
      }
    }

    schemaForConfigurationFile = appSchema
  }

  const configuration = (await parseConfigurationFile(
    schemaForConfigurationFile,
    configState.configurationPath,
    abort,
    decodeToml,
    file,
  )) as LoadedAppConfigFromConfigState<TConfig>
  const allClientIdsByConfigName = await getAllLinkedConfigClientIds(configState.appDirectory, {
    [configState.configurationFileName]: configuration.client_id,
  })

  let configurationLoadResultMetadata: ConfigurationLoadResultMetadata = {
    usesLinkedConfig: false,
    allClientIdsByConfigName,
  }

  // enhance metadata based on the config type
  switch (configState.state) {
    case 'template-only': {
      // nothing to add
      break
    }
    case 'connected-app': {
      let gitTracked = false
      try {
        gitTracked = await checkIfGitTracked(configState.appDirectory, configState.configurationPath)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // leave as false
      }

      configurationLoadResultMetadata = {
        ...configurationLoadResultMetadata,
        usesLinkedConfig: true,
        name: configState.configurationFileName,
        gitTracked,
        source: configState.configSource,
        usesCliManagedUrls: (configuration as LoadedAppConfigFromConfigState<AppConfigurationStateLinked>).build
          ?.automatically_update_urls_on_dev,
      }
    }
  }

  return {
    directory: configState.appDirectory,
    configuration,
    configurationLoadResultMetadata,
    configSchema: schemaForConfigurationFile,
    specifications,
    remoteFlags,
  }
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
 * Sometimes we want to run app commands from a nested folder (for example within an extension). So we need to
 * traverse up the filesystem to find the root app directory.
 *
 * @param directory - The current working directory, or the `--path` option
 */
async function getAppDirectory(directory: string) {
  if (!(await fileExists(directory))) {
    throw new AbortError(outputContent`Couldn't find directory ${outputToken.path(directory)}`)
  }

  // In order to find the chosen config for the app, we need to find the directory of the app.
  // But we can't know the chosen config because the cache key is the directory itself. So we
  // look for all possible `shopify.app.*toml` files and stop at the first directory that contains one.
  const appDirectory = await findPathUp(
    async (directory) => {
      const found = await glob(joinPath(directory, appConfigurationFileNameGlob))
      if (found.length > 0) {
        return directory
      }
    },
    {
      cwd: directory,
      type: 'directory',
    },
  )

  if (appDirectory) {
    return appDirectory
  } else {
    throw new AbortError(
      outputContent`Couldn't find an app toml file at ${outputToken.path(directory)}, is this an app directory?`,
    )
  }
}

/**
 * Looks for all likely linked config files in the app folder, parses, and returns a mapping of name to client ID.
 *
 * @param prefetchedConfigs - A mapping of config names to client IDs that have already been fetched from the filesystem.
 */
async function getAllLinkedConfigClientIds(
  appDirectory: string,
  prefetchedConfigs: {[key: string]: string | number | undefined},
): Promise<{[key: string]: string}> {
  const candidates = await glob(joinPath(appDirectory, appConfigurationFileNameGlob))

  const entries: [string, string][] = (
    await Promise.all(
      candidates.map(async (candidateFile) => {
        const configName = basename(candidateFile)
        if (prefetchedConfigs[configName] !== undefined && typeof prefetchedConfigs[configName] === 'string') {
          return [configName, prefetchedConfigs[configName]] as [string, string]
        }
        try {
          const configuration = await parseConfigurationFile(
            // we only care about the client ID, so no need to parse the entire file
            zod.object({client_id: zod.string().optional()}),
            candidateFile,
            // we're not interested in error reporting at all
            noopAbortOrReport,
          )
          if (configuration.client_id !== undefined) {
            return [configName, configuration.client_id] as [string, string]
          }
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch {
          // can ignore errors in parsing
        }
      }),
    )
  ).filter((entry) => entry !== undefined)
  return Object.fromEntries(entries)
}

export async function loadHiddenConfig(
  appDirectory: string,
  configuration: AppConfiguration,
): Promise<AppHiddenConfig> {
  const clientId = configuration.client_id
  if (!clientId || typeof clientId !== 'string') return {}

  return withHiddenConfigPathIn(appDirectory, async (hiddenConfigPath) => {
    if (fileExistsSync(hiddenConfigPath)) {
      try {
        const allConfigs: {[key: string]: AppHiddenConfig} = JSON.parse(await readFile(hiddenConfigPath))
        const currentAppConfig = allConfigs[clientId]

        if (currentAppConfig) return currentAppConfig

        // Migration from legacy format, can be safely removed in version >=3.77
        const oldConfig = allConfigs.dev_store_url
        if (oldConfig !== undefined && typeof oldConfig === 'string') {
          await patchAppHiddenConfigFile(hiddenConfigPath, clientId, {dev_store_url: oldConfig})
          return {dev_store_url: oldConfig}
        }
        return {}
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        return {}
      }
    } else {
      // If the hidden config file doesn't exist, create an empty one.
      await mkdir(dirname(hiddenConfigPath))
      await writeFile(hiddenConfigPath, '{}')
      return {}
    }
  })
}

export async function loadAppName(appDirectory: string): Promise<string> {
  const packageJSONPath = joinPath(appDirectory, 'package.json')
  return (await getPackageName(packageJSONPath)) ?? basename(appDirectory)
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
  const appUsesWorkspaces = app.usesWorkspaces

  await logMetadataForLoadedAppUsingRawValues(
    webs,
    extensionsToAddToMetrics,
    loadingStrategy,
    appName,
    appDirectory,
    sortedAppScopes,
    appUsesWorkspaces,
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

const appConfigurationFileNameRegex = /^shopify\.app(\.[-\w]+)?\.toml$/
const appConfigurationFileNameGlob = 'shopify.app*.toml'
export type AppConfigurationFileName = 'shopify.app.toml' | `shopify.app.${string}.toml`

/**
 * Gets the name of the app configuration file (e.g. `shopify.app.production.toml`) based on a provided config name.
 *
 * @param configName - Optional config name to base the file name upon
 * @returns Either the default app configuration file name (`shopify.app.toml`), the given config name (if it matched the valid format), or `shopify.app.<config name>.toml` if it was an arbitrary string
 */
export function getAppConfigurationFileName(configName?: string): AppConfigurationFileName {
  if (!configName) {
    return configurationFileNames.app
  }

  if (isValidFormatAppConfigurationFileName(configName)) {
    return configName
  } else {
    return `shopify.app.${slugify(configName)}.toml`
  }
}

/**
 * Given a path to an app configuration file, extract the shorthand section from the file name.
 *
 * This is undefined for `shopify.app.toml` files, or returns e.g. `production` for `shopify.app.production.toml`.
 */
export function getAppConfigurationShorthand(path: string) {
  const match = basename(path).match(appConfigurationFileNameRegex)
  return match?.[1]?.slice(1)
}

/** Checks if configName is a valid one (`shopify.app.toml`, or `shopify.app.<something>.toml`) */
export function isValidFormatAppConfigurationFileName(configName: string): configName is AppConfigurationFileName {
  if (appConfigurationFileNameRegex.test(configName)) {
    return true
  }
  return false
}

const printTargets = [
  'admin.order-details.print-action.render',
  'admin.order-index.selection-print-action.render',
  'admin.product-details.print-action.render',
  'admin.product-index.selection-print-action.render',
]
