import {AppErrors, isWebType} from './loader.js'
import {ConfigExtensionInstance, ExtensionInstance} from '../extensions/extension-instance.js'
import {isType} from '../../utilities/types.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ConfigExtensionSpecification} from '../extensions/specification.js'
import {Specifications} from '../extensions/load-specifications.js'
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

const ensurePathStartsWithSlash = (arg: unknown) => (typeof arg === 'string' && !arg.startsWith('/') ? `/${arg}` : arg)

export const AppSchema = zod.object({
  name: zod.string().max(30),
  client_id: zod.string(),
  extension_directories: zod.array(zod.string()).optional(),
  web_directories: zod.array(zod.string()).optional(),
  build: zod
    .object({
      automatically_update_urls_on_dev: zod.boolean().optional(),
      dev_store_url: zod.string().optional(),
    })
    .optional(),
})

export function getAppVersionedSchema(specs: ConfigExtensionSpecification[]) {
  return specs.reduce((schema, spec) => {
    return schema.merge(spec.schema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, AppSchema as any)
}

export const AppConfigurationSchema = zod.union([LegacyAppSchema, AppSchema])

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCurrentAppSchema(item: any): item is CurrentAppConfiguration {
  return getPathValue(item, 'client_id') !== undefined
}

/**
 * Check if the content is valid against the schema definition.
 * @param content - the content to validate
 * @param schema - the schema to validate against
 * @returns true if the content is valid against the schema definition, false otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAppSchema<T>(content: unknown, schema: zod.ZodType<T, any, any>) {
  return isType(schema, content)
}

/**
 * Get scopes from a given app.toml config file.
 * @param config - a configuration file
 */
export function getAppScopes(config: AppConfiguration) {
  if (isLegacyAppSchema(config)) {
    return config.scopes
  } else if (getPathValue(config, 'access_scopes.scopes')) {
    return getPathValue<string>(config, 'access_scopes.scopes') ?? ''
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
  if (isCurrentAppSchema(config)) {
    return getPathValue<boolean>(config, 'access_scopes.scopes.use_legacy_install_flow')
  }
  return false
}

export function appIsLaunchable(app: AppInterface) {
  const frontendConfig = app?.webs?.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = app?.webs?.find((web) => isWebType(web, WebType.Backend))

  return Boolean(frontendConfig || backendConfig)
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
export type CurrentAppConfiguration = zod.infer<typeof AppSchema> & {path: string}
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
  specifications: Specifications
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
  configExtensions: ConfigExtensionInstance[]
  errors?: AppErrors
  hasExtensions: () => boolean
  updateDependencies: () => Promise<void>
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => ExtensionInstance[]
  updateExtensionUUIDS: (uuids: {[key: string]: string}) => void
  preDeployValidation: () => Promise<void>
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
  specifications: Specifications
  allExtensions: ExtensionInstance[]
  configExtensions: ConfigExtensionInstance[]
  configSchema: zod.ZodTypeAny

  // eslint-disable-next-line max-params
  constructor(
    name: string,
    idEnvironmentVariableName: string,
    directory: string,
    packageManager: PackageManager,
    configuration: AppConfiguration,
    nodeDependencies: {[key: string]: string},
    webs: Web[],
    extensions: ExtensionInstance[],
    configExtensions: ConfigExtensionInstance[],
    usesWorkspaces: boolean,
    configSchema: zod.ZodTypeAny,
    specifications: Specifications,
    dotenv?: DotEnvFile,
    errors?: AppErrors,
  ) {
    this.name = name
    this.idEnvironmentVariableName = idEnvironmentVariableName
    this.directory = directory
    this.packageManager = packageManager
    this.configuration = configuration
    this.nodeDependencies = nodeDependencies
    this.webs = webs
    this.dotenv = dotenv
    this.allExtensions = extensions
    this.configExtensions = configExtensions
    this.errors = errors
    this.usesWorkspaces = usesWorkspaces
    this.configSchema = configSchema
    this.specifications = specifications
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
  constructor() {
    const configuration = {scopes: '', extension_directories: [], path: ''}
    super('', '', '', 'npm', configuration, {}, [], [], [], false, AppSchema, {
      generalSpecifications: [],
      configSpecifications: [],
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
