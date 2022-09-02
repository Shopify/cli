import {FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'
import {AppErrors} from './loader.js'
import {getUIExtensionRendererDependency, UIExtensionTypes} from '../../constants.js'
import {path, schema, file} from '@shopify/cli-kit'
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
  const rendererDependency = getUIExtensionRendererDependency(uiExtensionType)
  if (!rendererDependency) return undefined

  const fullName = rendererDependency.name
  let cwd = app.directory
  const isReact = fullName.includes('-react')

  /**
   * PNPM creates a symlink to a global cache where dependencies are hoisted. Therefore
   * we need to first look up the *-react package and use that as a working directory from
   * where to look up the non-react package.
   */
  if (isReact) {
    const dependencyName = fullName.split('/')
    const pattern = path.join('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')
    const reactPackageJsonPath = await path.findUp(pattern, {
      type: 'file',
      cwd: app.directory,
      allowSymlinks: true,
    })
    if (!reactPackageJsonPath) {
      return 'not_found'
    }
    cwd = await file.realpath(path.dirname(reactPackageJsonPath))
  }

  // Split the dependency name to avoid using "/" in windows
  const dependencyName = fullName.replace('-react', '').split('/')
  const pattern = path.join('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')

  let packagePath = await path.findUp(pattern, {
    cwd,
    type: 'file',
    allowSymlinks: true,
  })
  if (!packagePath) return 'not_found'
  packagePath = await file.realpath(packagePath)

  // Load the package.json and extract the version
  const packageContent = await readAndParsePackageJson(packagePath)
  if (!packageContent.version) return 'not_found'
  return {name: fullName, version: packageContent.version}
}
