import {UIExtension, ThemeExtension, FunctionExtension, Extension} from './extensions.js'
import {AppErrors, AppLoader, AppLoaderMode} from './app-loader.js'
import {getUIExtensionRendererDependency, UIExtensionTypes, dotEnvFileNames, ExtensionTypes} from '../../constants.js'
import {dependency, path, schema, string} from '@shopify/cli-kit'
import {writeDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'

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
  dotenv?: DotEnvFile
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }
  errors?: AppErrors
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
    await writeDotEnv(dotenvFile)
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
