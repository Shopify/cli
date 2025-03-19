/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {AppErrors, isWebType} from './loader.js'
import {ensurePathStartsWithSlash} from './validation/common.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {isType} from '../../utilities/types.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ExtensionSpecification, RemoteAwareExtensionSpecification} from '../extensions/specification.js'
import {AppConfigurationUsedByCli} from '../extensions/specifications/types/app_config.js'
import {EditorExtensionCollectionType} from '../extensions/specifications/editor_extension_collection.js'
import {UIExtensionSchema} from '../extensions/specifications/ui_extension.js'
import {CreateAppOptions, Flag} from '../../utilities/developer-platform-client.js'
import {AppAccessSpecIdentifier} from '../extensions/specifications/app_config_app_access.js'
import {WebhookSubscriptionSchema} from '../extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.js'
import {configurationFileNames} from '../../constants.js'
import {ApplicationURLs} from '../../services/dev/urls.js'
import {patchAppHiddenConfigFile} from '../../services/app/patch-app-configuration-file.js'
import {ZodObjectOf, zod} from '@shopify/cli-kit/node/schema'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, PackageManager, readAndParsePackageJson} from '@shopify/cli-kit/node/node-package-manager'
import {fileExistsSync, fileRealPath, findPathUp, readFileSync, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {normalizeDelimitedString} from '@shopify/cli-kit/common/string'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

// Schemas for loading app configuration

const ExtensionDirectoriesSchema = zod
  .array(zod.string())
  .optional()
  .transform(removeTrailingPathSeparator)
  .transform(fixSingleWildcards)

/**
 * Schema for a freshly minted app template.
 */
export const LegacyAppSchema = zod
  .object({
    client_id: zod.number().optional(),
    name: zod.string().optional(),
    scopes: zod
      .string()
      .transform((scopes) => normalizeDelimitedString(scopes) ?? '')
      .default(''),
    extension_directories: ExtensionDirectoriesSchema,
    web_directories: zod.array(zod.string()).optional(),
    webhooks: zod
      .object({
        api_version: zod.string({required_error: 'String is required'}),
        subscriptions: zod.array(WebhookSubscriptionSchema).optional(),
      })
      .optional(),
  })
  .strict()

function removeTrailingPathSeparator(value: string[] | undefined) {
  // eslint-disable-next-line no-useless-escape
  return value?.map((dir) => dir.replace(/[\/\\]+$/, ''))
}

// If a path ends with a single asterisk, modify it to end with a double asterisk.
// This is to support the glob pattern used by chokidar and watch for changes in subfolders.
function fixSingleWildcards(value: string[] | undefined) {
  // eslint-disable-next-line no-useless-escape
  return value?.map((dir) => dir.replace(/([^\*])\*$/, '$1**'))
}

/**
 * Schema for a normal, linked app. Properties from modules are not validated.
 */
export const AppSchema = zod.object({
  client_id: zod.string(),
  organization_id: zod.string().optional(),
  build: zod
    .object({
      automatically_update_urls_on_dev: zod.boolean().optional(),
      dev_store_url: zod.string().optional(),
      include_config_on_deploy: zod.boolean().optional(),
    })
    .optional(),
  extension_directories: ExtensionDirectoriesSchema,
  web_directories: zod.array(zod.string()).optional(),
})

/**
 * Hidden configuration for an app. Stored inside ./shopify/project.json
 * This is a set of values that are needed by the CLI that are not part of the app configuration.
 * These are not meant to be git tracked and the user doesn't need to know about their existence.
 */
export interface AppHiddenConfig {
  dev_store_url?: string
}

/**
 * Utility schema that matches freshly minted or normal, linked, apps.
 */
export const AppConfigurationSchema = zod.union([LegacyAppSchema, AppSchema])

// Types representing post-validated app configurations

/**
 * App configuration for something validated as either a freshly minted app template or a normal, linked, app.
 *
 * Try to avoid using this: generally you should be working with a more specific type.
 */
export type AppConfiguration = zod.infer<typeof AppConfigurationSchema> & {path: string}

export type AppConfigurationWithoutPath = zod.infer<typeof AppConfigurationSchema>

/**
 * App configuration for a normal, linked, app. Doesn't include properties that are module derived.
 */
export type BasicAppConfigurationWithoutModules = zod.infer<typeof AppSchema> & {path: string}

/**
 * The build section for a normal, linked app. The options here tweak the CLI's behavior when working with the app.
 */
export type CliBuildPreferences = BasicAppConfigurationWithoutModules['build']

/**
 * App configuration for a normal, linked, app -- including properties that are module derived, such as scopes etc.
 */
export type CurrentAppConfiguration = BasicAppConfigurationWithoutModules & AppConfigurationUsedByCli

/**
 * App configuration for a freshly minted app template. Very old apps *may* have a client_id provided.
 */
export type LegacyAppConfiguration = zod.infer<typeof LegacyAppSchema> & {path: string}

/** Validation schema that produces a provided app configuration type */
export type SchemaForConfig<TConfig extends {path: string}> = ZodObjectOf<Omit<TConfig, 'path'>>

export function getAppVersionedSchema(
  specs: ExtensionSpecification[],
  allowDynamicallySpecifiedConfigs = true,
): ZodObjectOf<Omit<CurrentAppConfiguration, 'path'>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = specs.reduce<any>((schema, spec) => spec.contributeToAppConfigurationSchema(schema), AppSchema)

  if (allowDynamicallySpecifiedConfigs) {
    return schema.passthrough()
  } else {
    return specs.length > 0 ? schema.strict() : schema
  }
}

/**
 * Check whether a shopify.app.toml schema is valid against the legacy schema definition.
 * @param item - the item to validate
 */
export function isLegacyAppSchema(item: AppConfiguration): item is LegacyAppConfiguration {
  const {path, ...rest} = item
  return isType(LegacyAppSchema, rest)
}

/**
 * Check whether a shopify.app.toml schema is valid against the current schema definition.
 * @param item - the item to validate
 */
export function isCurrentAppSchema(item: AppConfiguration): item is CurrentAppConfiguration {
  const {path, ...rest} = item
  return isType(AppSchema.nonstrict(), rest)
}

/**
 * Get scopes from a given app.toml config file.
 * @param config - a configuration file
 */
export function getAppScopes(config: AppConfiguration): string {
  if (isLegacyAppSchema(config)) {
    return config.scopes
  } else if (isCurrentAppSchema(config)) {
    return config.access_scopes?.scopes ?? ''
  }
  return ''
}

/**
 * Get scopes as an array from a given app.toml config file.
 * @param config - a configuration file
 */
export function getAppScopesArray(config: AppConfiguration) {
  const scopes = getAppScopes(config)
  return scopes.length ? scopes.split(',').map((scope) => scope.trim()) : []
}

export function usesLegacyScopesBehavior(config: AppConfiguration) {
  if (isLegacyAppSchema(config)) return true
  if (isCurrentAppSchema(config)) return config.access_scopes?.use_legacy_install_flow ?? false
  return false
}

export function appHiddenConfigPath(appDirectory: string) {
  return joinPath(appDirectory, configurationFileNames.hiddenFolder, configurationFileNames.hiddenConfig)
}

/**
 * Get the field names from the configuration that aren't found in the basic built-in app configuration schema.
 */
export function filterNonVersionedAppFields(configuration: object): string[] {
  const builtInFieldNames = Object.keys(AppSchema.shape).concat('path')
  return Object.keys(configuration).filter((fieldName) => {
    return !builtInFieldNames.includes(fieldName)
  })
}

export enum WebType {
  Frontend = 'frontend',
  Backend = 'backend',
  Background = 'background',
}

const WebConfigurationAuthCallbackPathSchema = zod.preprocess(ensurePathStartsWithSlash, zod.string())

const baseWebConfigurationSchema = zod.object({
  auth_callback_path: zod
    .union([WebConfigurationAuthCallbackPathSchema, WebConfigurationAuthCallbackPathSchema.array()])
    .optional(),
  webhooks_path: zod.preprocess(ensurePathStartsWithSlash, zod.string()).optional(),
  port: zod.number().max(65536).min(0).optional(),
  commands: zod.object({
    build: zod.string().optional(),
    predev: zod.string().optional(),
    dev: zod.string(),
  }),
  name: zod.string().optional(),
  hmr_server: zod.object({http_paths: zod.string().array()}).optional(),
})
const webTypes = zod.enum([WebType.Frontend, WebType.Backend, WebType.Background]).default(WebType.Frontend)
export const WebConfigurationSchema = zod.union([
  baseWebConfigurationSchema.extend({roles: zod.array(webTypes)}),
  baseWebConfigurationSchema.extend({type: webTypes}),
])
export const ProcessedWebConfigurationSchema = baseWebConfigurationSchema.extend({roles: zod.array(webTypes)})

export type WebConfiguration = zod.infer<typeof WebConfigurationSchema>
export type ProcessedWebConfiguration = zod.infer<typeof ProcessedWebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: ProcessedWebConfiguration
  framework?: string
}

export interface AppConfigurationInterface<
  TConfig extends AppConfiguration = AppConfiguration,
  TModuleSpec extends ExtensionSpecification = ExtensionSpecification,
> {
  directory: string
  configuration: TConfig
  configSchema: SchemaForConfig<TConfig>
  specifications: TModuleSpec[]
  remoteFlags: Flag[]
}

export type AppLinkedInterface = AppInterface<CurrentAppConfiguration, RemoteAwareExtensionSpecification>

export interface AppInterface<
  TConfig extends AppConfiguration = AppConfiguration,
  TModuleSpec extends ExtensionSpecification = ExtensionSpecification,
> extends AppConfigurationInterface<TConfig, TModuleSpec> {
  name: string
  packageManager: PackageManager
  idEnvironmentVariableName: 'SHOPIFY_API_KEY'
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  allExtensions: ExtensionInstance[]
  realExtensions: ExtensionInstance[]
  draftableExtensions: ExtensionInstance[]
  errors?: AppErrors
  hiddenConfig: AppHiddenConfig
  includeConfigOnDeploy: boolean | undefined
  readonly devApplicationURLs?: ApplicationURLs
  updateDependencies: () => Promise<void>
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => ExtensionInstance[]
  updateExtensionUUIDS: (uuids: {[key: string]: string}) => void
  preDeployValidation: () => Promise<void>
  /**
   * Checks if the app has any elements that means it can be "launched" -- can host its own app home section.
   *
   * @returns true if the app can be launched, false otherwise
   */
  appIsLaunchable: () => boolean

  /**
   * If creating an app on the platform based on this app and its configuration, what default options should the app take?
   */
  creationDefaultOptions(): CreateAppOptions
  manifest: () => Promise<JsonMapType>
  removeExtension: (extensionUid: string) => void
  updateHiddenConfig: (values: Partial<AppHiddenConfig>) => Promise<void>
  setDevApplicationURLs: (devApplicationURLs: ApplicationURLs) => void
  generateExtensionTypes(): Promise<void>
}

type AppConstructor<
  TConfig extends AppConfiguration,
  TModuleSpec extends ExtensionSpecification,
> = AppConfigurationInterface<TConfig, TModuleSpec> & {
  name: string
  packageManager: PackageManager
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  modules: ExtensionInstance[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  specifications: ExtensionSpecification[]
  remoteFlags?: Flag[]
  hiddenConfig: AppHiddenConfig
  devApplicationURLs?: ApplicationURLs
}

export class App<
  TConfig extends AppConfiguration = AppConfiguration,
  TModuleSpec extends ExtensionSpecification = ExtensionSpecification,
> implements AppInterface<TConfig, TModuleSpec>
{
  name: string
  idEnvironmentVariableName: 'SHOPIFY_API_KEY' = 'SHOPIFY_API_KEY' as const
  directory: string
  packageManager: PackageManager
  configuration: TConfig
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  specifications: TModuleSpec[]
  configSchema: ZodObjectOf<Omit<TConfig, 'path'>>
  remoteFlags: Flag[]
  realExtensions: ExtensionInstance[]
  devApplicationURLs?: ApplicationURLs
  private _hiddenConfig: AppHiddenConfig

  constructor({
    name,
    directory,
    packageManager,
    configuration,
    nodeDependencies,
    webs,
    modules,
    usesWorkspaces,
    dotenv,
    errors,
    specifications,
    configSchema,
    remoteFlags,
    hiddenConfig,
    devApplicationURLs,
  }: AppConstructor<TConfig, TModuleSpec>) {
    this.name = name
    this.directory = directory
    this.packageManager = packageManager
    this.configuration = configuration
    this.nodeDependencies = nodeDependencies
    this.webs = webs
    this.dotenv = dotenv
    this.realExtensions = modules
    this.errors = errors
    this.usesWorkspaces = usesWorkspaces
    this.specifications = specifications
    this.configSchema = configSchema ?? AppSchema
    this.remoteFlags = remoteFlags ?? []
    this._hiddenConfig = hiddenConfig
    if (devApplicationURLs) this.setDevApplicationURLs(devApplicationURLs)
  }

  get allExtensions() {
    if (this.includeConfigOnDeploy) return this.realExtensions
    return this.realExtensions.filter((ext) => !ext.isAppConfigExtension)
  }

  get draftableExtensions() {
    return this.realExtensions.filter(
      (ext) => ext.isUUIDStrategyExtension || ext.specification.identifier === AppAccessSpecIdentifier,
    )
  }

  get appManagementApiEnabled() {
    if (isLegacyAppSchema(this.configuration)) return false
    return this.configuration.organization_id !== undefined
  }

  setDevApplicationURLs(devApplicationURLs: ApplicationURLs) {
    this.patchAppConfiguration(devApplicationURLs)
    this.realExtensions.forEach((ext) => ext.patchWithAppDevURLs(devApplicationURLs))
  }

  async manifest(): Promise<JsonMapType> {
    const modules = await Promise.all(
      this.realExtensions.map(async (module) => {
        const config = await module.deployConfig({
          apiKey: String(this.configuration.client_id ?? ''),
          appConfiguration: this.configuration,
        })
        return {
          type: module.externalType,
          handle: module.handle,
          uid: module.uid,
          assets: module.uid,
          target: module.contextValue,
          config: (config ?? {}) as JsonMapType,
        }
      }),
    )

    return {
      name: this.name,
      handle: '',
      modules: getArrayRejectingUndefined(modules),
    }
  }

  async updateDependencies() {
    const nodeDependencies = await getDependencies(joinPath(this.directory, 'package.json'))
    this.nodeDependencies = nodeDependencies
  }

  get hiddenConfig() {
    return this._hiddenConfig
  }

  async updateHiddenConfig(values: Partial<AppHiddenConfig>) {
    if (!this.configuration.client_id) return
    this._hiddenConfig = deepMergeObjects(this.hiddenConfig, values)
    const path = appHiddenConfigPath(this.directory)
    await patchAppHiddenConfigFile(path, String(this.configuration.client_id), this.hiddenConfig)
  }

  async preDeployValidation() {
    const functionExtensionsWithUiHandle = this.allExtensions.filter(
      (ext) => ext.isFunctionExtension && (ext.configuration as unknown as FunctionConfigType).ui?.handle,
    ) as ExtensionInstance<FunctionConfigType>[]

    if (functionExtensionsWithUiHandle.length > 0) {
      const errors = validateFunctionExtensionsWithUiHandle(functionExtensionsWithUiHandle, this.allExtensions)
      if (errors) {
        throw new AbortError('Invalid function configuration', errors.join('\n'))
      }
    }

    const extensionCollections = this.allExtensions.filter(
      (ext) => ext.isEditorExtensionCollection,
    ) as ExtensionInstance<EditorExtensionCollectionType>[]

    if (extensionCollections.length > 0) {
      const errors = validateExtensionsHandlesInCollection(extensionCollections, this.allExtensions)
      if (errors) {
        throw new AbortError('Invalid editor extension collection configuration', errors.join('\n\n'))
      }
    }

    await Promise.all([this.allExtensions.map((ext) => ext.preDeployValidation())])
  }

  extensionsForType(specification: {identifier: string; externalIdentifier: string}): ExtensionInstance[] {
    return this.allExtensions.filter(
      (extension) => extension.type === specification.identifier || extension.type === specification.externalIdentifier,
    )
  }

  updateExtensionUUIDS(uuids: {[key: string]: string}) {
    this.allExtensions.forEach((extension) => {
      extension.devUUID = uuids[extension.localIdentifier] ?? extension.devUUID
    })
  }

  appIsLaunchable() {
    const frontendConfig = this.webs.find((web) => isWebType(web, WebType.Frontend))
    const backendConfig = this.webs.find((web) => isWebType(web, WebType.Backend))

    return Boolean(frontendConfig ?? backendConfig)
  }

  get appIsEmbedded() {
    if (isCurrentAppSchema(this.configuration)) return this.configuration.embedded
    return this.appIsLaunchable()
  }

  creationDefaultOptions(): CreateAppOptions {
    return {
      isLaunchable: this.appIsLaunchable(),
      scopesArray: getAppScopesArray(this.configuration),
      name: this.name,
      isEmbedded: this.appIsEmbedded,
      directory: this.directory,
    }
  }

  removeExtension(extensionUid: string) {
    this.realExtensions = this.realExtensions.filter((ext) => ext.uid !== extensionUid)
  }

  async generateExtensionTypes() {
    const typeFilePath = joinPath(this.directory, 'shopify.d.ts')
    let firstImport = ''
    const sharedTypes = await Promise.all(
      this.allExtensions.map((extension) => extension.contributeToSharedTypeFile(typeFilePath)),
    )
    const combinedDefinitions = new Set()
    sharedTypes.forEach((shared) => {
      shared.forEach(({libraryRoot, definition}) => {
        if (!firstImport) {
          firstImport = `import '${libraryRoot}';\n`
        }
        combinedDefinitions.add(definition)
      })
    })

    if (combinedDefinitions.size === 0) {
      return
    }

    const originalContent = fileExistsSync(typeFilePath) ? readFileSync(typeFilePath).toString() : ''
    const typeContent = [firstImport, ...Array.from(combinedDefinitions)].join('\n')
    if (originalContent === typeContent) {
      return
    }
    // Adding a top-level import to the type file allows us to workaround the TS restriction of not allowing declaring modules with relative paths
    writeFileSync(typeFilePath, [firstImport, ...Array.from(combinedDefinitions)].join('\n'))
  }

  get includeConfigOnDeploy() {
    if (isLegacyAppSchema(this.configuration)) return false
    if (this.appManagementApiEnabled) return true
    return this.configuration.build?.include_config_on_deploy
  }

  private patchAppConfiguration(devApplicationURLs: ApplicationURLs) {
    if (!isCurrentAppSchema(this.configuration)) return

    this.devApplicationURLs = devApplicationURLs
    this.configuration.application_url = devApplicationURLs.applicationUrl
    if (devApplicationURLs.appProxy) {
      this.configuration.app_proxy = {
        url: devApplicationURLs.appProxy.proxyUrl,
        subpath: devApplicationURLs.appProxy.proxySubPath,
        prefix: devApplicationURLs.appProxy.proxySubPathPrefix,
      }
    }
    if (this.configuration.auth?.redirect_urls) {
      this.configuration.auth.redirect_urls = devApplicationURLs.redirectUrlWhitelist
    }
  }
}

export function validateFunctionExtensionsWithUiHandle(
  functionExtensionsWithUiHandle: ExtensionInstance<FunctionConfigType>[],
  allExtensions: ExtensionInstance[],
): string[] | undefined {
  const errors: string[] = []

  functionExtensionsWithUiHandle.forEach((extension) => {
    const uiHandle = extension.configuration.ui!.handle!

    const matchingExtension = findExtensionByHandle(allExtensions, uiHandle)
    if (!matchingExtension) {
      errors.push(`[${extension.name}] - Local app must contain a ui_extension with handle '${uiHandle}'`)
    } else if (matchingExtension.type !== 'ui_extension') {
      errors.push(
        `[${extension.name}] - Local app must contain one extension of type 'ui_extension' and handle '${uiHandle}'`,
      )
    }
  })

  return errors.length > 0 ? errors : undefined
}

export type UIExtensionType = zod.infer<typeof UIExtensionSchema>

export function validateExtensionsHandlesInCollection(
  editorExtensionCollections: ExtensionInstance<EditorExtensionCollectionType>[],
  allExtensions: ExtensionInstance[],
): string[] | undefined {
  const errors: string[] = []

  const allowableTypesForExtensionInCollection = ['ui_extension']
  editorExtensionCollections.forEach((collection) => {
    collection.configuration.inCollection.forEach((extension) => {
      const matchingExtension = findExtensionByHandle(allExtensions, extension.handle)

      if (!matchingExtension) {
        errors.push(
          `[${collection.handle}] editor extension collection: Add extension with handle '${extension.handle}' to local app. Local app must include extension with handle '${extension.handle}'.`,
        )
      } else if (!allowableTypesForExtensionInCollection.includes(matchingExtension.specification.identifier)) {
        errors.push(
          `[${collection.handle}] editor extension collection: Remove extension of type '${matchingExtension.specification.identifier}' from this collection. This extension type is not supported in collections.`,
        )
      } else if (matchingExtension.specification.identifier === 'ui_extension') {
        const uiExtension = matchingExtension as ExtensionInstance<UIExtensionType>
        uiExtension.configuration.extension_points.forEach((extensionPoint) => {
          if (extensionPoint.target.startsWith('admin.')) {
            errors.push(
              `[${collection.handle}] editor extension collection: Remove extension '${matchingExtension.configuration.handle}' with target '${extensionPoint.target}' from this collection. This extension target is not supported in collections.`,
            )
          }
        })
      }
    })
  })

  return errors.length > 0 ? errors : undefined
}

function findExtensionByHandle(allExtensions: ExtensionInstance[], handle: string): ExtensionInstance | undefined {
  return allExtensions.find((ext) => ext.handle === handle)
}

type RendererVersionResult = {name: string; version: string} | undefined | 'not_found'

/**
 * Given a UI extension, it returns the version of the renderer package.
 * Looks for `/node_modules/@shopify/{renderer-package-name}/package.json` to find the real version used.
 * @param extension - UI extension whose renderer version will be obtained.
 * @returns The version if the dependency exists.
 */
export async function getUIExtensionRendererVersion(extension: ExtensionInstance): Promise<RendererVersionResult> {
  // Look for the vanilla JS version of the dependency (the react one depends on it, will always be present)
  const rendererDependency = extension.dependency
  if (!rendererDependency) return undefined
  return getDependencyVersion(rendererDependency, extension.directory)
}

export async function getDependencyVersion(dependency: string, directory: string): Promise<RendererVersionResult> {
  // Split the dependency name to avoid using "/" in windows. Only look for non react dependencies.
  const dependencyName = dependency.replace('-react', '').split('/')
  const pattern = joinPath('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')

  let packagePath = await findPathUp(pattern, {
    cwd: directory,
    type: 'file',
    allowSymlinks: true,
  })
  if (!packagePath) return 'not_found'
  packagePath = await fileRealPath(packagePath)

  // Load the package.json and extract the version
  const packageContent = await readAndParsePackageJson(packagePath)
  if (!packageContent.version) return 'not_found'
  return {name: dependency, version: packageContent.version}
}
