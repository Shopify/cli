import {AppErrors} from './loader.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {isType} from '../../utilities/types.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, PackageManager, readAndParsePackageJson} from '@shopify/cli-kit/node/node-package-manager'
import {fileRealPath, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

export const LegacyAppSchema = zod.object({
  extension_directories: zod.array(zod.string()).optional(),
  web_directories: zod.array(zod.string()).optional(),
  scopes: zod.string().default(''),
})

export const AppSchema = zod.object({
  extension_directories: zod.array(zod.string()).optional(),
  web_directories: zod.array(zod.string()).optional(),
  name: zod.string().optional(),
  client_id: zod.string().optional(),
  application_url: zod.string().optional(),
  redirect_url_allowlist: zod.array(zod.string()).optional(),
  requested_access_scopes: zod.array(zod.string()).optional(),
  scopes: zod.string().optional(),
})

export const AppConfigurationSchema = zod.union([LegacyAppSchema, AppSchema])

export interface SchemaValidationOptions {
  strict?: boolean
}

/**
 * Check whether a shopify.app.toml schema is valid against the legacy schema definition.
 * @param item - the item to validate
 * @param strict - whether to allow keys not defined in the schema
 */
export function isLegacyAppSchema(
  item: unknown,
  options?: SchemaValidationOptions,
): item is zod.infer<typeof LegacyAppSchema> {
  if (options?.strict) return isType(LegacyAppSchema.strict(), item)
  return isType(LegacyAppSchema, item)
}

/**
 * Check whether a shopify.app.toml schema is valid against the current schema definition.
 * @param item - the item to validate
 * @param strict - whether to allow keys not defined in the schema
 */
export function isCurrentAppSchema(
  item: unknown,
  options?: SchemaValidationOptions,
): item is zod.infer<typeof AppSchema> {
  if (options?.strict) return isType(AppSchema.strict(), item)
  return isType(AppSchema, item)
}

/**
 * Check whether a shopify.app.toml schema is valid.
 * @param item - the item to validate
 * @param strict - whether to allow keys not defined in the schema
 */
export function isValidAppSchema(
  item: unknown,
  options?: SchemaValidationOptions,
): item is zod.infer<typeof AppConfigurationSchema> {
  return isLegacyAppSchema(item, {strict: options?.strict}) || isCurrentAppSchema(item, {strict: options?.strict})
}

/**
 * Get scopes from a given app.toml config file.
 * @param config - a configuration file
 */
export function getAppScopes(config: unknown) {
  if (!config) return ''

  if (!isValidAppSchema(config)) {
    throw new AbortError('Invalid configuration')
  }

  if (isLegacyAppSchema(config)) {
    return config.scopes
  }

  if (isCurrentAppSchema(config)) {
    if (config.requested_access_scopes) {
      return config.requested_access_scopes.toString()
    } else if (config.scopes) {
      return config.scopes
    } else {
      return ''
    }
  }

  throw new AbortError('Invalid configuration')
}

export enum WebType {
  Frontend = 'frontend',
  Backend = 'backend',
  Background = 'background',
}

const ensurePathStartsWithSlash = (arg: unknown) => (typeof arg === 'string' && !arg.startsWith('/') ? `/${arg}` : arg)

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
})
const webTypes = zod.enum([WebType.Frontend, WebType.Backend, WebType.Background]).default(WebType.Frontend)
export const WebConfigurationSchema = zod.union([
  baseWebConfigurationSchema.extend({roles: zod.array(webTypes)}),
  baseWebConfigurationSchema.extend({type: webTypes}),
])
export const ProcessedWebConfigurationSchema = baseWebConfigurationSchema.extend({roles: zod.array(webTypes)})

export type AppConfiguration = zod.infer<typeof AppConfigurationSchema>
export type WebConfiguration = zod.infer<typeof WebConfigurationSchema>
export type ProcessedWebConfiguration = zod.infer<typeof ProcessedWebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: ProcessedWebConfiguration
  framework?: string
}

export interface AppInterface {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  allExtensions: ExtensionInstance[]
  errors?: AppErrors
  hasExtensions: () => boolean
  updateDependencies: () => Promise<void>
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => ExtensionInstance[]
}

export class App implements AppInterface {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  allExtensions: ExtensionInstance[]

  // eslint-disable-next-line max-params
  constructor(
    name: string,
    idEnvironmentVariableName: string,
    directory: string,
    packageManager: PackageManager,
    configuration: AppConfiguration,
    configurationPath: string,
    nodeDependencies: {[key: string]: string},
    webs: Web[],
    extensions: ExtensionInstance[],
    usesWorkspaces: boolean,
    dotenv?: DotEnvFile,
    errors?: AppErrors,
  ) {
    this.name = name
    this.idEnvironmentVariableName = idEnvironmentVariableName
    this.directory = directory
    this.packageManager = packageManager
    this.configuration = configuration
    this.configurationPath = configurationPath
    this.nodeDependencies = nodeDependencies
    this.webs = webs
    this.dotenv = dotenv
    this.allExtensions = extensions
    this.errors = errors
    this.usesWorkspaces = usesWorkspaces
  }

  async updateDependencies() {
    const nodeDependencies = await getDependencies(joinPath(this.directory, 'package.json'))
    this.nodeDependencies = nodeDependencies
  }

  hasExtensions(): boolean {
    return this.allExtensions.length > 0
  }

  extensionsForType(specification: {identifier: string; externalIdentifier: string}): ExtensionInstance[] {
    return this.allExtensions.filter(
      (extension) => extension.type === specification.identifier || extension.type === specification.externalIdentifier,
    )
  }
}

type RendererVersionResult = {name: string; version: string} | undefined | 'not_found'

/**
 * Given a UI extension and the app it belongs to, it returns the version of the renderer package.
 * Looks for `/node_modules/@shopify/{renderer-package-name}/package.json` to find the real version used.
 * @param uiExtensionType - UI extension whose renderer version will be obtained.
 * @param app - App object containing the extension.
 * @returns The version if the dependency exists.
 */
export async function getUIExtensionRendererVersion(
  extension: ExtensionInstance,
  app: AppInterface,
): Promise<RendererVersionResult> {
  // Look for the vanilla JS version of the dependency (the react one depends on it, will always be present)
  const rendererDependency = extension.dependency
  if (!rendererDependency) return undefined
  return getDependencyVersion(rendererDependency, app.directory)
}

export async function getDependencyVersion(dependency: string, directory: string): Promise<RendererVersionResult> {
  const isReact = dependency.includes('-react')
  let cwd = directory
  /**
   * PNPM creates a symlink to a global cache where dependencies are hoisted. Therefore
   * we need to first look up the *-react package and use that as a working directory from
   * where to look up the non-react package.
   */
  if (isReact) {
    const dependencyName = dependency.split('/')
    const pattern = joinPath('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')
    const reactPackageJsonPath = await findPathUp(pattern, {
      type: 'file',
      cwd: directory,
      allowSymlinks: true,
    })
    if (!reactPackageJsonPath) {
      return 'not_found'
    }
    cwd = await fileRealPath(dirname(reactPackageJsonPath))
  }

  // Split the dependency name to avoid using "/" in windows
  const dependencyName = dependency.replace('-react', '').split('/')
  const pattern = joinPath('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')

  let packagePath = await findPathUp(pattern, {
    cwd,
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
