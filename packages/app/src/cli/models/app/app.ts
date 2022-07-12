import {FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'
import {AppErrors} from './loader.js'
import {getUIExtensionRendererDependency, UIExtensionTypes} from '../../constants.js'
import {path, schema} from '@shopify/cli-kit'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, PackageManager, readAndParsePackageJson} from '@shopify/cli-kit/node/node-package-manager'

export const AppConfigurationSchema = schema.define.object({
  scopes: schema.define.string().default(''),
})

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

export type AppConfiguration = schema.define.infer<typeof AppConfigurationSchema>
export type WebConfiguration = schema.define.infer<typeof WebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: WebConfiguration
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
  dotenv?: DotEnvFile
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }
  errors?: AppErrors
  hasExtensions: () => boolean
  updateDependencies: () => Promise<void>
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
  dotenv?: DotEnvFile
  errors?: AppErrors
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }

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
    ui: UIExtension[],
    theme: ThemeExtension[],
    functions: FunctionExtension[],
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
    this.extensions = {
      ui,
      theme,
      function: functions,
    }
    this.errors = errors
  }

  async updateDependencies() {
    const nodeDependencies = await getDependencies(path.join(this.directory, 'package.json'))
    this.nodeDependencies = nodeDependencies
  }

  hasExtensions(): boolean {
    return (
      this.extensions.ui.length !== 0 || this.extensions.function.length !== 0 || this.extensions.theme.length !== 0
    )
  }
}

type RendererVersionResult = {name: string; version: string} | undefined | 'not_found'

/**
 * Given a UI extension and the app it belongs to, it returns the version of the renderer package.
 * Looks for `/node_modules/@shopify/{renderer-package-name}/package.json` to find the real version used.
 * @param uiExtensionType {UIExtensionTypes} UI extension whose renderer version will be obtained.
 * @param app {AppInterface} App object containing the extension.
 * @returns {{name: string; version: string} | undefined} The version if the dependency exists.
 */
export async function getUIExtensionRendererVersion(
  uiExtensionType: UIExtensionTypes,
  app: AppInterface,
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
  const packageContent = await readAndParsePackageJson(packagePath)
  if (!packageContent.version) return 'not_found'
  return {name: fullName, version: packageContent.version}
}
