import {
  blocks,
  configurationFileNames,
  functionExtensions,
  themeExtensions,
  uiExtensions,
  getUIExtensionRendererDependency,
  UIExtensionTypes,
  dotEnvFileNames,
  ExtensionTypes,
} from '../../constants'
import {dependency, dotenv, error, file, id, path, schema, string, toml, output} from '@shopify/cli-kit'

export interface IdentifiersExtensions {
  [localIdentifier: string]: string
}

export interface Identifiers {
  /** Application's API Key */
  app: string

  /**
   * The extensions' unique identifiers.
   */
  extensions: IdentifiersExtensions

  /**
   * The extensions' numeric identifiers (expressed as a string).
   */
  extensionIds: IdentifiersExtensions
}

export type UuidOnlyIdentifiers = Omit<Identifiers, 'extensionIds'>

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

  // Only for WebPixel
  runtimeContext: schema.define.string().optional(),
  version: schema.define.string().optional(),
  configuration: schema.define.any().optional(),
})

type UIExtensionConfiguration = schema.define.infer<typeof UIExtensionConfigurationSchema>

const FunctionExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(functionExtensions.types),
  description: schema.define.string().default(''),
  build: schema.define.object({
    command: schema.define.string(),
    path: schema.define.string().optional(),
  }),
  configurationUi: schema.define.boolean().optional().default(true),
  ui: schema.define
    .object({
      paths: schema.define
        .object({
          create: schema.define.string(),
          details: schema.define.string(),
        })
        .optional(),
    })
    .optional(),
  apiVersion: schema.define.string(),
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

const FunctionExtensionMetadataSchema = schema.define.object({
  schemaVersions: schema.define.object({}).catchall(
    schema.define.object({
      major: schema.define.number(),
      minor: schema.define.number(),
    }),
  ),
})

type FunctionExtensionMetadata = schema.define.infer<typeof FunctionExtensionMetadataSchema>

export type FunctionExtension = Extension & {
  configuration: FunctionExtensionConfiguration
  metadata: FunctionExtensionMetadata
  buildWasmPath: () => string
  inputQueryPath: () => string
}

export type ThemeExtension = Extension & {
  configuration: ThemeExtensionConfiguration
}

export type UIExtension = Extension & {
  configuration: UIExtensionConfiguration
  buildDirectory: string
  entrySourceFilePath: string
  devUUID: string
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

export interface App {
  name: string
  idEnvironmentVariableName: string
  directory: string
  dependencyManager: dependency.DependencyManager
  configuration: AppConfiguration
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  dotenv?: dotenv.DotEnvFile
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
    [key: string]: output.Message
  } = {}

  addError(path: string, message: output.Message): void {
    this.errors[path] = message
  }

  getError(path: string): output.Message {
    return this.errors[path]
  }

  isEmpty() {
    return Object.keys(this.errors).length === 0
  }

  toJSON(): output.Message[] {
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
    const dotenv = await this.loadDotEnv()
    const functions = await this.loadFunctions(extensionsPath)
    const uiExtensions = await this.loadUIExtensions(extensionsPath)
    const themeExtensions = await this.loadThemeExtensions(extensionsPath)
    const packageJSONPath = path.join(this.appDirectory, 'package.json')
    const name = await dependency.getPackageName(packageJSONPath)
    const nodeDependencies = await dependency.getDependencies(packageJSONPath)
    const dependencyManager = await dependency.getDependencyManager(this.appDirectory)

    const app: App = {
      name,
      idEnvironmentVariableName: 'SHOPIFY_API_KEY',
      directory: this.appDirectory,
      webs: await this.loadWebs(),
      configuration,
      configurationPath,
      dotenv,
      extensions: {ui: uiExtensions, theme: themeExtensions, function: functions},
      dependencyManager,
      nodeDependencies,
    }
    if (!this.errors.isEmpty()) app.errors = this.errors
    return app
  }

  async loadDotEnv(): Promise<dotenv.DotEnvFile | undefined> {
    let dotEnvFile: dotenv.DotEnvFile | undefined
    const dotEnvPath = path.join(this.appDirectory, dotEnvFileNames.production)
    if (await file.exists(dotEnvPath)) {
      dotEnvFile = await dotenv.read(dotEnvPath)
    }
    return dotEnvFile
  }

  async findAppDirectory() {
    if (!(await file.exists(this.directory))) {
      throw new error.Abort(output.content`Couldn't find directory ${output.token.path(this.directory)}`)
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
      throw new error.Abort(
        output.content`Couldn't find the configuration file for ${output.token.path(
          this.directory,
        )}, are you in an app directory?`,
      )
    }

    this.configurationPath = configurationPath
    return configurationPath
  }

  async loadWebs(): Promise<Web[]> {
    const webTomlPaths = await path.glob(path.join(this.appDirectory, `web/**/${configurationFileNames.web}`))

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))

    return webs
  }

  async loadWeb(WebConfigurationFile: string): Promise<Web> {
    return {
      directory: path.dirname(WebConfigurationFile),
      configuration: await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile),
    }
  }

  async loadConfigurationFile(
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = toml.decode,
  ): Promise<unknown> {
    if (!(await file.exists(filepath))) {
      return this.abortOrReport(
        output.content`Couldn't find the configuration file at ${output.token.path(filepath)}`,
        '',
        filepath,
      )
    }
    const configurationContent = await file.read(filepath)
    let configuration: object
    try {
      configuration = decode(configurationContent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // TOML errors have line, pos and col properties
      if (err.line && err.pos && err.col) {
        return this.abortOrReport(
          output.content`Fix the following error in ${output.token.path(filepath)}:\n${err.message}`,
          null,
          filepath,
        )
      } else {
        throw err
      }
    }
    // Convert snake_case keys to camelCase before returning
    return {
      ...Object.fromEntries(Object.entries(configuration).map((kv) => [string.camelize(kv[0]), kv[1]])),
    }
  }

  async parseConfigurationFile<TSchema extends schema.define.ZodType>(
    schema: TSchema,
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = toml.decode,
  ): Promise<schema.define.TypeOf<TSchema>> {
    const fallbackOutput = {} as schema.define.TypeOf<TSchema>

    const configurationObject = await this.loadConfigurationFile(filepath, decode)
    if (!configurationObject) return fallbackOutput

    const parseResult = schema.safeParse(configurationObject)

    if (!parseResult.success) {
      const formattedError = JSON.stringify(parseResult.error.issues, null, 2)
      return this.abortOrReport(
        output.content`Fix a schema error in ${output.token.path(filepath)}:\n${formattedError}`,
        fallbackOutput,
        filepath,
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
      const entrySourceFilePath = (
        await Promise.all(
          ['index']
            .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
            .flatMap((fileName) => [`src/${fileName}`, `${fileName}`])
            .map((relativePath) => path.join(directory, relativePath))
            .map(async (sourcePath) => ((await file.exists(sourcePath)) ? sourcePath : undefined)),
        )
      ).find((sourcePath) => sourcePath !== undefined)
      if (!entrySourceFilePath) {
        this.abortOrReport(
          output.content`Couldn't find an index.{js,jsx,ts,tsx} file in the directories ${output.token.path(
            directory,
          )} or ${output.token.path(path.join(directory, 'src'))}`,
          undefined,
          directory,
        )
      }

      return {
        idEnvironmentVariableName: `SHOPIFY_${string.constantize(path.basename(directory))}_ID`,
        directory,
        configuration,
        configurationPath,
        type: configuration.type,
        graphQLType: extensionGraphqlId(configuration.type),
        buildDirectory: path.join(directory, 'dist'),
        entrySourceFilePath: entrySourceFilePath ?? '',
        localIdentifier: path.basename(directory),
        // The convention is that unpublished extensions will have a random UUID with prefix `dev-`
        devUUID: `dev-${id.generateRandomUUID()}`,
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
      const metadata = await this.parseConfigurationFile(
        FunctionExtensionMetadataSchema,
        path.join(directory, 'metadata.json'),
        JSON.parse,
      )
      return {
        directory,
        configuration,
        configurationPath,
        metadata,
        type: configuration.type,
        graphQLType: extensionGraphqlId(configuration.type),
        idEnvironmentVariableName: `SHOPIFY_${string.constantize(path.basename(directory))}_ID`,
        localIdentifier: path.basename(directory),
        buildWasmPath() {
          return configuration.build.path
            ? path.join(directory, configuration.build.path)
            : path.join(directory, 'dist/index.wasm')
        },
        inputQueryPath() {
          return path.join(directory, 'input.graphql')
        },
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

  abortOrReport<T>(errorMessage: output.Message, fallback: T, configurationPath: string): T {
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

type UpdateAppIdentifiersCommand = 'dev' | 'deploy'

interface UpdateAppIdentifiersOptions {
  app: App
  identifiers: UuidOnlyIdentifiers
  command: UpdateAppIdentifiersCommand
}

/**
 * Given an app and a set of identifiers, it persists the identifiers in the .env files.
 * @param options {UpdateAppIdentifiersOptions} Options.
 * @returns {App} An copy of the app with the environment updated to reflect the updated identifiers.
 */
export async function updateAppIdentifiers(
  {app, identifiers, command}: UpdateAppIdentifiersOptions,
  systemEnvironment = process.env,
): Promise<App> {
  let dotenvFile = app.dotenv
  if (!dotenvFile) {
    dotenvFile = {
      path: path.join(app.directory, dotEnvFileNames.production),
      variables: {},
    }
  }
  const updatedVariables: {[key: string]: string} = {...(app.dotenv?.variables ?? {})}
  if (!systemEnvironment[app.idEnvironmentVariableName]) {
    updatedVariables[app.idEnvironmentVariableName] = identifiers.app
  }
  Object.keys(identifiers.extensions).forEach((identifier) => {
    const envVariable = `SHOPIFY_${string.constantize(identifier)}_ID`
    if (!systemEnvironment[envVariable]) {
      updatedVariables[envVariable] = identifiers.extensions[identifier]
    }
  })

  const write = JSON.stringify(dotenvFile.variables) !== JSON.stringify(updatedVariables) && command === 'deploy'
  dotenvFile.variables = updatedVariables
  if (write) {
    await dotenv.write(dotenvFile)
  }
  return {
    ...app,
    dotenv: dotenvFile,
  }
}

interface GetAppIdentifiersOptions {
  app: App
}

/**
 * Given an app and a environment, it fetches the ids from the environment
 * and returns them.
 * @param options {GetAppIdentifiersOptions} Options.
 * @returns
 */
export function getAppIdentifiers(
  {app}: GetAppIdentifiersOptions,
  systemEnvironment = process.env,
): Partial<UuidOnlyIdentifiers> {
  const envVariables = {
    ...app.dotenv?.variables,
    ...(systemEnvironment as {[variable: string]: string}),
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

type RendererVersionResult = {name: string; version: string} | undefined | 'not_found'

/**
 * Given a UI extension and the app it belongs to, it returns the version of the renderer package.
 * Looks for `/node_modules/@shopify/{renderer-package-name}/package.json` to find the real version used.
 * @param uiExtensionType {UIExtensionTypes} UI extension whose renderer version will be obtained.
 * @param app {App} App object containing the extension.
 * @returns {{name: string; version: string} | undefined} The version if the dependency exists.
 */
export async function getUIExtensionRendererVersion(
  uiExtensionType: UIExtensionTypes,
  app: App,
): Promise<RendererVersionResult> {
  // Look for the vanilla JS version of the dependency (the react one depends on it, will always be present)
  const fullName = getUIExtensionRendererDependency(uiExtensionType)?.name.replace('-react', '')
  if (!fullName) return undefined
  // Split the dependency name to avoid using "/" in windows
  const dependencyName = fullName.split('/')

  // Find the package.json in the project structure
  const realPath = path.join('node_modules', dependencyName[0], dependencyName[1], 'package.json')
  const packagePath = await path.findUp(realPath, {type: 'file', cwd: app.directory})
  if (!packagePath) return 'not_found'

  // Load the package.json and extract the version
  const packageContent = await dependency.packageJSONContents(packagePath)
  if (!packageContent.version) return 'not_found'
  return {name: fullName, version: packageContent.version}
}

export async function load(directory: string, mode: AppLoaderMode = 'strict'): Promise<App> {
  const loader = new AppLoader({directory, mode})
  return loader.loaded()
}

export function hasExtensions(app: App): boolean {
  return app.extensions.ui.length !== 0 || app.extensions.function.length !== 0 || app.extensions.theme.length !== 0
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
    case 'pos_ui_extension':
      return 'POS_UI_EXTENSION'
    case 'theme':
      return 'THEME_APP_EXTENSION'
    case 'web_pixel_extension':
      return 'WEB_PIXEL_EXTENSION'
    case 'product_discounts':
    case 'order_discounts':
    case 'shipping_discounts':
    case 'payment_methods':
    case 'shipping_rate_presenter':
      // As we add new extensions, this bug will force us to add a new case here.
      return type
  }
}
