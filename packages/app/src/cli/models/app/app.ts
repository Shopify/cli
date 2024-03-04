import {AppErrors, isWebType} from './loader.js'
import {ensurePathStartsWithSlash} from './validation/common.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {isType} from '../../utilities/types.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {SpecsAppConfiguration} from '../extensions/specifications/types/app_config.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {BetaFlag} from '../../services/dev/fetch.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, PackageManager, readAndParsePackageJson} from '@shopify/cli-kit/node/node-package-manager'
import {fileRealPath, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getPathValue} from '@shopify/cli-kit/common/object'

export const LegacyAppSchema = zod
  .object({
    client_id: zod.number().optional(),
    name: zod.string().optional(),
    scopes: zod.string().default(''),
    extension_directories: zod.array(zod.string()).optional(),
    web_directories: zod.array(zod.string()).optional(),
  })
  .strict()

export const AppSchema = zod.object({
  client_id: zod.string(),
  build: zod
    .object({
      automatically_update_urls_on_dev: zod.boolean().optional(),
      dev_store_url: zod.string().optional(),
      include_config_on_deploy: zod.boolean().optional(),
    })
    .optional(),
  extension_directories: zod.array(zod.string()).optional(),
  web_directories: zod.array(zod.string()).optional(),
})

export const AppConfigurationSchema = zod.union([LegacyAppSchema, AppSchema])

export function getAppVersionedSchema(specs: ExtensionSpecification[]) {
  const isConfigSpecification = (spec: ExtensionSpecification) => spec.experience === 'configuration'
  const schema = specs
    .filter(isConfigSpecification)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((schema, spec) => schema.merge(spec.schema), AppSchema as any)

  return specs.length > 0 ? schema.strict() : schema
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

export function appIsLaunchable(app: AppInterface) {
  const frontendConfig = app?.webs?.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = app?.webs?.find((web) => isWebType(web, WebType.Backend))

  return Boolean(frontendConfig || backendConfig)
}

export function filterNonVersionedAppFields(configuration: {[key: string]: unknown}) {
  return Object.keys(configuration).filter(
    (fieldName) => !Object.keys(AppSchema.shape).concat('path').includes(fieldName),
  )
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

export type AppConfiguration = zod.infer<typeof AppConfigurationSchema> & {path: string}
export type CurrentAppConfiguration = zod.infer<typeof AppSchema> & {path: string} & SpecsAppConfiguration
export type LegacyAppConfiguration = zod.infer<typeof LegacyAppSchema> & {path: string}
export type WebConfiguration = zod.infer<typeof WebConfigurationSchema>
export type ProcessedWebConfiguration = zod.infer<typeof ProcessedWebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: ProcessedWebConfiguration
  framework?: string
}

export interface AppConfigurationInterface {
  directory: string
  configuration: AppConfiguration
  configSchema: zod.ZodTypeAny
}

export interface AppInterface extends AppConfigurationInterface {
  name: string
  idEnvironmentVariableName: string
  packageManager: PackageManager
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  allExtensions: ExtensionInstance[]
  draftableExtensions: ExtensionInstance[]
  specifications?: ExtensionSpecification[]
  errors?: AppErrors
  includeConfigOnDeploy: boolean | undefined
  remoteBetaFlags: BetaFlag[]
  hasExtensions: () => boolean
  updateDependencies: () => Promise<void>
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => ExtensionInstance[]
  updateExtensionUUIDS: (uuids: {[key: string]: string}) => void
  preDeployValidation: () => Promise<void>
}

interface AppConstructor {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  modules: ExtensionInstance[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  specifications?: ExtensionSpecification[]
  configSchema?: zod.ZodTypeAny
  remoteBetaFlags?: BetaFlag[]
}

export class App implements AppInterface {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  specifications?: ExtensionSpecification[]
  configSchema: zod.ZodTypeAny
  remoteBetaFlags: BetaFlag[]
  private realExtensions: ExtensionInstance[]

  constructor({
    name,
    idEnvironmentVariableName,
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
    remoteBetaFlags,
  }: AppConstructor) {
    this.name = name
    this.idEnvironmentVariableName = idEnvironmentVariableName
    this.directory = directory
    this.packageManager = packageManager
    this.configuration = this.configurationTyped(configuration)
    this.nodeDependencies = nodeDependencies
    this.webs = webs
    this.dotenv = dotenv
    this.realExtensions = modules
    this.errors = errors
    this.usesWorkspaces = usesWorkspaces
    this.specifications = specifications
    this.configSchema = configSchema ?? AppSchema
    this.remoteBetaFlags = remoteBetaFlags ?? []
  }

  get allExtensions() {
    return this.realExtensions.filter((ext) => !ext.isAppConfigExtension || this.includeConfigOnDeploy)
  }

  get draftableExtensions() {
    return this.realExtensions.filter((ext) => ext.isDraftable())
  }

  async updateDependencies() {
    const nodeDependencies = await getDependencies(joinPath(this.directory, 'package.json'))
    this.nodeDependencies = nodeDependencies
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

    await Promise.all([this.allExtensions.map((ext) => ext.preDeployValidation())])
  }

  hasExtensions(): boolean {
    return this.allExtensions.length > 0
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

  get includeConfigOnDeploy() {
    if (isLegacyAppSchema(this.configuration)) return false
    return this.configuration.build?.include_config_on_deploy
  }

  private configurationTyped(configuration: AppConfiguration) {
    if (isLegacyAppSchema(configuration)) return configuration
    return {
      ...configuration,
      ...buildSpecsAppConfiguration(configuration),
    } as CurrentAppConfiguration & SpecsAppConfiguration
  }
}

export function buildSpecsAppConfiguration(content: object) {
  return {
    ...homeConfiguration(content),
    ...appProxyConfiguration(content),
    ...posConfiguration(content),
    ...webhooksConfiguration(content),
    ...accessConfiguration(content),
  }
}

function appProxyConfiguration(configuration: object) {
  if (!getPathValue(configuration, 'app_proxy')) return
  return {
    app_proxy: {
      url: getPathValue<string>(configuration, 'app_proxy.url')!,
      prefix: getPathValue<string>(configuration, 'app_proxy.prefix')!,
      subpath: getPathValue<string>(configuration, 'app_proxy.subpath')!,
    },
  }
}

function homeConfiguration(configuration: object) {
  const appPreferencesUrl = getPathValue<string>(configuration, 'app_preferences.url')
  return {
    name: getPathValue<string>(configuration, 'name')!,
    application_url: getPathValue<string>(configuration, 'application_url')!,
    embedded: getPathValue<boolean>(configuration, 'embedded')!,
    ...(appPreferencesUrl ? {app_preferences: {url: appPreferencesUrl}} : {}),
  }
}

function posConfiguration(configuration: object) {
  const embedded = getPathValue<boolean>(configuration, 'pos.embedded')
  return embedded === undefined
    ? undefined
    : {
        pos: {
          embedded,
        },
      }
}

function webhooksConfiguration(configuration: object) {
  return {
    webhooks: {...getPathValue<WebhooksConfig>(configuration, 'webhooks')},
  }
}

function accessConfiguration(configuration: object) {
  const scopes = getPathValue<string>(configuration, 'access_scopes.scopes')
  const useLegacyInstallFlow = getPathValue<boolean>(configuration, 'access_scopes.use_legacy_install_flow')
  const redirectUrls = getPathValue<string[]>(configuration, 'auth.redirect_urls')
  return {
    ...(scopes || useLegacyInstallFlow ? {access_scopes: {scopes, use_legacy_install_flow: useLegacyInstallFlow}} : {}),
    ...(redirectUrls ? {auth: {redirect_urls: redirectUrls}} : {}),
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
    } else if (matchingExtension.configuration.type !== 'ui_extension') {
      errors.push(
        `[${extension.name}] - Local app must contain one extension of type 'ui_extension' and handle '${uiHandle}'`,
      )
    }
  })

  return errors.length > 0 ? errors : undefined
}

function findExtensionByHandle(allExtensions: ExtensionInstance[], handle: string): ExtensionInstance | undefined {
  return allExtensions.find((ext) => ext.handle === handle)
}

export class EmptyApp extends App {
  constructor(specifications?: ExtensionSpecification[], betas?: BetaFlag[], clientId?: string) {
    const configuration = clientId
      ? {client_id: clientId, access_scopes: {scopes: ''}, path: ''}
      : {scopes: '', path: ''}
    const configSchema = getAppVersionedSchema(specifications ?? [])
    super({
      name: '',
      idEnvironmentVariableName: '',
      directory: '',
      packageManager: 'npm',
      configuration,
      nodeDependencies: {},
      webs: [],
      modules: [],
      usesWorkspaces: false,
      specifications,
      configSchema,
      remoteBetaFlags: betas ?? [],
    })
  }
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
