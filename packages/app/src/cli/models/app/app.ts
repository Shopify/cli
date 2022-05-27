import {
  blocks,
  configurationFileNames,
  genericConfigurationFileNames,
  functionExtensions,
  themeExtensions,
  uiExtensions,
  getUIExtensionRendererDependency,
  UIExtensionTypes,
  dotEnvFileNames,
  ExtensionTypes,
} from '../../constants'
import {dependency, dotenv, error, file, path, schema, string, toml} from '@shopify/cli-kit'

export const WebConfigurationFileNotFound = (directory: string) => {
  return new error.Abort(`Couldn't find ${configurationFileNames.web} in ${directory}`)
}

export interface Identifiers {
  /** Application's API Key */
  app: string

  /**
   * The extensions' unique identifiers.
   */
  extensions: {
    [localIdentifier: string]: string
  }
}

export const AppConfigurationSchema = schema.define.object({
  scopes: schema.define.string().default(''),
})

export type AppConfiguration = schema.define.infer<typeof AppConfigurationSchema>

const UIExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(uiExtensions.types),
  metafields: schema.define
    .array(
      schema.define.object({
        namespace: schema.define.string(),
        key: schema.define.string(),
      }),
    )
    .default([]),
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  capabilities: schema.define.any().optional(),
})

type UIExtensionConfiguration = schema.define.infer<typeof UIExtensionConfigurationSchema>

const FunctionExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(functionExtensions.types),
  title: schema.define.string(),
})

type FunctionExtensionConfiguration = schema.define.infer<typeof FunctionExtensionConfigurationSchema>

const ThemeExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(themeExtensions.types),
})

type ThemeExtensionConfiguration = schema.define.infer<typeof ThemeExtensionConfigurationSchema>

export interface Extension {
  idEnvironmentVariableName: string
  localIdentifier: string
  configurationPath: string
  directory: string
  type: ExtensionTypes
  graphQLType: string
}

export type FunctionExtension = Extension & {
  configuration: FunctionExtensionConfiguration
}

export type ThemeExtension = Extension & {
  configuration: ThemeExtensionConfiguration
}

export type UIExtension = Extension & {
  configuration: UIExtensionConfiguration
  buildDirectory: string
  entrySourceFilePath: string
}

export enum WebType {
  Frontend = 'frontend',
  Backend = 'backend',
}

export const WebConfigurationSchema = schema.define.object({
  type: schema.define.enum([WebType.Frontend, WebType.Backend]),
  commands: schema.define.object({
    build: schema.define.string().optional(),
    dev: schema.define.string(),
  }),
})

export type WebConfiguration = schema.define.infer<typeof WebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: WebConfiguration
}

export interface AppEnvironment {
  dotenv: {
    production?: dotenv.DotEnvFile
  }
  env: {[key: string]: string}
}

export interface App {
  name: string
  idEnvironmentVariableName: string
  directory: string
  dependencyManager: dependency.DependencyManager
  configuration: AppConfiguration
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  environment: AppEnvironment
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }
  errors?: AppErrors
}

export type AppLoaderMode = 'strict' | 'report'

interface AppLoaderConstructorArgs {
  directory: string
  mode: AppLoaderMode
}

class AppErrors {
  private errors: {
    [key: string]: string
  } = {}

  addError(path: string, message: string): void {
    this.errors[path] = message
  }

  getError(path: string): string {
    return this.errors[path]
  }

  isEmpty() {
    return Object.keys(this.errors).length === 0
  }

  toJSON(): string[] {
    return Object.values(this.errors)
  }
}

class AppLoader {
  private directory: string
  private mode: AppLoaderMode
  private appDirectory = ''
  private configurationPath = ''
  private errors: AppErrors = new AppErrors()

  constructor({directory, mode}: AppLoaderConstructorArgs) {
    this.mode = mode
    this.directory = directory
  }

  async loaded() {
    this.appDirectory = await this.findAppDirectory()
    const configurationPath = await this.getConfigurationPath()
    const configuration = await this.parseConfigurationFile(AppConfigurationSchema, configurationPath)
    const extensionsPath = path.join(this.appDirectory, `${blocks.extensions.directoryName}`)
    const environment = await this.loadEnvironment()
    const functions = await this.loadFunctions(extensionsPath)
    const uiExtensions = await this.loadUIExtensions(extensionsPath)
    const themeExtensions = await this.loadThemeExtensions(extensionsPath)
    const yarnLockPath = path.join(this.appDirectory, genericConfigurationFileNames.yarn.lockfile)
    const yarnLockExists = await file.exists(yarnLockPath)
    const pnpmLockPath = path.join(this.appDirectory, genericConfigurationFileNames.pnpm.lockfile)
    const pnpmLockExists = await file.exists(pnpmLockPath)
    const packageJSONPath = path.join(this.appDirectory, 'package.json')
    const name = await dependency.getPackageName(packageJSONPath)
    const nodeDependencies = await dependency.getDependencies(packageJSONPath)
    let dependencyManager: dependency.DependencyManager
    if (yarnLockExists) {
      dependencyManager = 'yarn'
    } else if (pnpmLockExists) {
      dependencyManager = 'pnpm'
    } else {
      dependencyManager = 'npm'
    }

    const app: App = {
      name,
      idEnvironmentVariableName: 'SHOPIFY_APP_API_KEY',
      directory: this.appDirectory,
      webs: await this.loadWebs(),
      configuration,
      configurationPath,
      environment,
      extensions: {ui: uiExtensions, theme: themeExtensions, function: functions},
      dependencyManager,
      nodeDependencies,
    }
    if (!this.errors.isEmpty()) app.errors = this.errors
    return app
  }

  async loadEnvironment(systemEnv: {[key: string]: string | undefined} = process.env): Promise<AppEnvironment> {
    const env = Object.fromEntries(
      Object.entries(systemEnv).filter(([key, value]) => {
        return key.startsWith('SHOPIFY_') && value
      }),
    ) as {[key: string]: string}

    let productionEnv: dotenv.DotEnvFile | undefined
    const productionEnvPath = path.join(this.appDirectory, dotEnvFileNames.production)
    if (await file.exists(productionEnvPath)) {
      productionEnv = await dotenv.read(productionEnvPath)
    }
    return {
      dotenv: {
        production: productionEnv,
      },
      env,
    }
  }

  async findAppDirectory() {
    if (!(await file.exists(this.directory))) {
      throw new error.Abort(`Couldn't find directory ${this.directory}`)
    }
    return path.dirname(await this.getConfigurationPath())
  }

  async getConfigurationPath() {
    if (this.configurationPath) return this.configurationPath

    const configurationPath = await path.findUp(configurationFileNames.app, {
      cwd: this.directory,
      type: 'file',
    })
    if (!configurationPath) {
      throw new error.Abort(`Couldn't find the configuration file for ${this.directory}, are you in an app directory?`)
    }

    this.configurationPath = configurationPath
    return configurationPath
  }

  async loadWebs(): Promise<Web[]> {
    const webTomlPaths = await path.glob(path.join(this.appDirectory, `**/${configurationFileNames.web}`))

    if (webTomlPaths.length === 0) {
      throw WebConfigurationFileNotFound(this.appDirectory)
    }

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))

    return webs
  }

  async loadWeb(WebConfigurationFile: string): Promise<Web> {
    return {
      directory: path.dirname(WebConfigurationFile),
      configuration: await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile),
    }
  }

  async loadConfigurationFile(path: string): Promise<unknown> {
    if (!(await file.exists(path))) {
      return this.abortOrReport(`Couldn't find the configuration file at ${path}`, '', path)
    }
    const configurationContent = await file.read(path)
    // Convert snake_case keys to camelCase before returning
    return {
      ...Object.fromEntries(
        Object.entries(toml.decode(configurationContent)).map((kv) => [string.camelize(kv[0]), kv[1]]),
      ),
    }
  }

  async parseConfigurationFile<TSchema extends schema.define.ZodType>(
    schema: TSchema,
    path: string,
  ): Promise<schema.define.TypeOf<TSchema>> {
    const fallbackOutput = {} as schema.define.TypeOf<TSchema>

    const configurationObject = await this.loadConfigurationFile(path)
    console.log(configurationObject)
    if (!configurationObject) return fallbackOutput

    const parseResult = schema.safeParse(configurationObject)
    if (!parseResult.success) {
      return this.abortOrReport(
        `Invalid schema in ${path}:\n${JSON.stringify(parseResult.error.issues, null, 2)}`,
        fallbackOutput,
        path,
      )
    }
    return parseResult.data
  }

  async loadUIExtensions(extensionsPath: string): Promise<UIExtension[]> {
    const extensionConfigPaths = path.join(extensionsPath, `*/${configurationFileNames.extension.ui}`)
    const configPaths = await path.glob(extensionConfigPaths)

    const extensions = configPaths.map(async (configurationPath) => {
      const directory = path.dirname(configurationPath)
      const configuration = await this.parseConfigurationFile(UIExtensionConfigurationSchema, configurationPath)
      return {
        idEnvironmentVariableName: `SHOPIFY_${string.constantize(path.basename(directory))}_ID`,
        directory,
        configuration,
        configurationPath,
        type: configuration.type,
        graphQLType: extensionGraphqlId(configuration.type),
        buildDirectory: path.join(directory, 'build'),
        entrySourceFilePath: path.join(directory, 'src/index.js'),
        localIdentifier: path.basename(directory),
      }
    })
    return Promise.all(extensions)
  }

  async loadFunctions(extensionsPath: string): Promise<FunctionExtension[]> {
    const functionConfigPaths = await path.join(extensionsPath, `*/${configurationFileNames.extension.function}`)
    const configPaths = await path.glob(functionConfigPaths)

    const functions = configPaths.map(async (configurationPath) => {
      const directory = path.dirname(configurationPath)
      const configuration = await this.parseConfigurationFile(FunctionExtensionConfigurationSchema, configurationPath)
      return {
        directory,
        configuration,
        configurationPath,
        type: configuration.type,
        graphQLType: extensionGraphqlId(configuration.type),
        idEnvironmentVariableName: `SHOPIFY_${string.constantize(path.basename(directory))}_ID`,
        localIdentifier: path.basename(directory),
      }
    })
    return Promise.all(functions)
  }

  async loadThemeExtensions(extensionsPath: string): Promise<ThemeExtension[]> {
    const themeConfigPaths = await path.join(extensionsPath, `*/${configurationFileNames.extension.theme}`)
    const configPaths = await path.glob(themeConfigPaths)

    const themeExtensions = configPaths.map(async (configurationPath) => {
      const directory = path.dirname(configurationPath)
      const configuration = await this.parseConfigurationFile(ThemeExtensionConfigurationSchema, configurationPath)
      return {
        directory,
        configuration,
        configurationPath,
        type: configuration.type,
        graphQLType: extensionGraphqlId(configuration.type),
        idEnvironmentVariableName: `SHOPIFY_${string.constantize(path.basename(directory))}_ID`,
        localIdentifier: path.basename(directory),
      }
    })
    return Promise.all(themeExtensions)
  }

  abortOrReport<T>(errorMessage: string, fallback: T, configurationPath: string): T {
    if (this.mode === 'strict') {
      throw new error.Abort(errorMessage)
    } else {
      this.errors.addError(configurationPath, errorMessage)
      return fallback
    }
  }
}

/**
 * Reads the dependencies from the app's package.json and creates a copy
 * of the app with the list of dependencies updated.
 * @param app {App} App whose Node dependencies will be updated.
 * @returns {Promise<App>} The app with the Node dependencies updated.
 */
export async function updateDependencies(app: App): Promise<App> {
  const nodeDependencies = await dependency.getDependencies(path.join(app.directory, 'package.json'))
  return {
    ...app,
    nodeDependencies,
  }
}

export type EnvironmentType = 'production'

interface UpdateAppIdentifiersOptions {
  app: App
  identifiers: Identifiers
  environmentType: EnvironmentType
}

/**
 * Given an app and a set of identifiers, it persists the identifiers in the .env files.
 * @param options {UpdateAppIdentifiersOptions} Options.
 * @returns {App} An copy of the app with the environment updated to reflect the updated identifiers.
 */
export async function updateAppIdentifiers({
  app,
  identifiers,
  environmentType,
}: UpdateAppIdentifiersOptions): Promise<App> {
  const envVariables = Object.keys(app.environment.env)
  let dotenvFile = app.environment.dotenv.production
  if (!dotenvFile) {
    dotenvFile = {
      path: path.join(app.directory, dotEnvFileNames.production),
      variables: {},
    }
  }
  const variables: {[key: string]: string} = {}
  if (!envVariables.includes(app.idEnvironmentVariableName)) {
    variables[app.idEnvironmentVariableName] = identifiers.app
  }
  Object.keys(identifiers.extensions).forEach((identifier) => {
    const envVariable = `SHOPIFY_${string.constantize(identifier)}_ID`
    if (!envVariables.includes(envVariable)) {
      variables[envVariable] = identifiers.extensions[identifier]
    }
  })
  const write = JSON.stringify(dotenvFile.variables) !== JSON.stringify(variables)
  dotenvFile.variables = variables
  if (write) {
    await dotenv.write(dotenvFile)
  }
  return {
    ...app,
    environment: {
      env: app.environment.env,
      dotenv: {
        production: dotenvFile,
      },
    },
  }
}

interface GetAppIdentifiersOptions {
  app: App
  environmentType: EnvironmentType
}

/**
 * Given an app and a environment, it fetches the ids from the environment
 * and returns them.
 * @param options {GetAppIdentifiersOptions} Options.
 * @returns
 */
export function getAppIdentifiers({app, environmentType}: GetAppIdentifiersOptions): Partial<Identifiers> {
  const envVariables = {
    ...app.environment.env,
    ...app.environment.dotenv.production?.variables,
  }
  const extensionsIdentifiers: {[key: string]: string} = {}
  const processExtension = (extension: Extension) => {
    if (Object.keys(envVariables).includes(extension.idEnvironmentVariableName)) {
      extensionsIdentifiers[extension.localIdentifier] = envVariables[extension.idEnvironmentVariableName]
    }
  }
  app.extensions.ui.forEach(processExtension)
  app.extensions.function.forEach(processExtension)
  app.extensions.theme.forEach(processExtension)

  return {
    app: envVariables[app.idEnvironmentVariableName],
    extensions: extensionsIdentifiers,
  }
}

/**
 * Given a UI extension and the app it belongs to, it returns the version of the renderer
 * package.
 * @param uiExtensionType {UIExtensionTypes} UI extension whose renderer version will be obtained.
 * @param app {App} App object containing the extension.
 * @returns {{name: string; version: string} | undefined} The version if the dependency exists.
 */
export function getUIExtensionRendererVersion(
  uiExtensionType: UIExtensionTypes,
  app: App,
): {name: string; version: string} | undefined {
  const nodeDependencies = app.nodeDependencies
  const rendererDependencyName = getUIExtensionRendererDependency(uiExtensionType)
  if (!rendererDependencyName) {
    return undefined
  }
  const rendererDependency = nodeDependencies[rendererDependencyName]
  if (!rendererDependency) {
    return undefined
  }
  return {name: rendererDependencyName, version: rendererDependency}
}

export async function load(directory: string, mode: AppLoaderMode = 'strict'): Promise<App> {
  const loader = new AppLoader({directory, mode})
  return loader.loaded()
}

/**
 * Each extension has a different ID in graphQL.
 * Sometimes the ID is the same as the type, sometimes it's different.
 * @param type {string} The extension type
 * @returns {string} The extension GraphQL ID
 */
export const extensionGraphqlId = (type: ExtensionTypes) => {
  switch (type) {
    case 'product_subscription':
      return 'SUBSCRIPTION_MANAGEMENT'
    case 'checkout_ui_extension':
      return 'CHECKOUT_UI_EXTENSION'
    case 'checkout_post_purchase':
      return 'CHECKOUT_POST_PURCHASE'
    case 'theme':
      return 'THEME_APP_EXTENSION'
    case 'beacon_extension':
    case 'product_discounts':
    case 'order_discounts':
    case 'shipping_discounts':
    case 'payment_methods':
    case 'shipping_rate_presenter':
      // As we add new extensions, this bug will force us to add a new case here.
      return type
  }
}
