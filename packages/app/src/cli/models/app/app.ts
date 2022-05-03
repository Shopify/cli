import {file, error, path, schema, string, toml} from '@shopify/cli-kit'
import {
  blocks,
  configurationFileNames,
  genericConfigurationFileNames,
  functionExtensions,
  themeExtensions,
  uiExtensions,
} from '$cli/constants'

export const HomeConfigurationFileNotFound = (directory: string) => {
  return new error.Abort(`Couldn't find ${configurationFileNames.home} in ${directory}`)
}

export const AppConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  id: schema.define.optional(schema.define.string()),
  scopes: schema.define.string(),
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

interface FunctionExtension {
  configuration: FunctionExtensionConfiguration
  directory: string
}

interface ThemeExtension {
  configuration: ThemeExtensionConfiguration
  directory: string
}

export interface UIExtension {
  configuration: UIExtensionConfiguration
  directory: string
  buildDirectory: string
  entrySourceFilePath: string
}

export enum HomeType {
  Frontend = 'frontend',
  Backend = 'backend',
}

export const HomeConfigurationSchema = schema.define.object({
  type: schema.define.enum([HomeType.Frontend, HomeType.Backend]),
  commands: schema.define.object({
    build: schema.define.string().optional(),
    dev: schema.define.string(),
  }),
})

export type HomeConfiguration = schema.define.infer<typeof HomeConfigurationSchema>
export type HomeConfigurationCommands = keyof HomeConfiguration['commands']

export interface Home {
  directory: string
  configuration: HomeConfiguration
}

type PackageManager = 'npm' | 'yarn' | 'pnpm'

export interface App {
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  homes: Home[]
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }
  errors?: string[]
}

export type AppLoaderMode = 'strict' | 'report'

interface AppLoaderConstructorArgs {
  directory: string
  mode: AppLoaderMode
}

class AppLoader {
  private directory: string
  private mode: AppLoaderMode
  private appDirectory = ''
  private configurationPath = ''
  private errors: string[] = []

  constructor({directory, mode}: AppLoaderConstructorArgs) {
    this.mode = mode
    this.directory = directory
  }

  async loaded() {
    this.errors = []
    this.appDirectory = await this.findAppDirectory()
    const configuration = await this.parseConfigurationFile(AppConfigurationSchema, await this.getConfigurationPath())
    const extensionsPath = path.join(this.directory, `${blocks.extensions.directoryName}`)
    const functions = await this.loadFunctions(extensionsPath)
    const extensions = await this.loadExtensions(extensionsPath)
    const themeExtensions = await this.loadThemeExtensions(extensionsPath)
    const yarnLockPath = path.join(this.appDirectory, genericConfigurationFileNames.yarn.lockfile)
    const yarnLockExists = await file.exists(yarnLockPath)
    const pnpmLockPath = path.join(this.appDirectory, genericConfigurationFileNames.pnpm.lockfile)
    const pnpmLockExists = await file.exists(pnpmLockPath)
    let packageManager: PackageManager
    if (yarnLockExists) {
      packageManager = 'yarn'
    } else if (pnpmLockExists) {
      packageManager = 'pnpm'
    } else {
      packageManager = 'npm'
    }

    const app: App = {
      directory: this.appDirectory,
      homes: await this.loadHomes(),
      configuration,
      extensions: {ui: extensions, theme: themeExtensions, function: functions},
      packageManager,
    }
    if (this.errors.length > 0) app.errors = this.errors
    return app
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

  async loadHomes(): Promise<Home[]> {
    const homeTomlPaths = await path.glob(path.join(this.appDirectory, `**/${configurationFileNames.home}`))

    if (homeTomlPaths.length === 0) {
      throw HomeConfigurationFileNotFound(this.appDirectory)
    }

    const homes = await Promise.all(homeTomlPaths.map((path) => this.loadHome(path)))

    return homes
  }

  async loadHome(homeConfigurationFile: string): Promise<Home> {
    return {
      directory: path.dirname(homeConfigurationFile),
      configuration: await this.parseConfigurationFile(HomeConfigurationSchema, homeConfigurationFile),
    }
  }

  async loadConfigurationFile(path: string): Promise<object> {
    if (!(await file.exists(path))) {
      return this.abortOrReport(`Couldn't find the configuration file at ${path}`, '')
    }
    const configurationContent = await file.read(path)
    // Convert snake_case keys to camelCase before returning
    return Object.fromEntries(
      Object.entries(toml.decode(configurationContent)).map((kv) => [string.camelize(kv[0]), kv[1]]),
    )
  }

  async parseConfigurationFile(schema: any, path: string) {
    const configurationObject = await this.loadConfigurationFile(path)
    if (!configurationObject) return {}

    const parseResult = schema.safeParse(configurationObject)
    if (!parseResult.success) {
      this.abortOrReport(`Invalid schema in ${path}:\n${JSON.stringify(parseResult.error.issues, null, 2)}`, {})
    }
    return parseResult.data
  }

  async loadExtensions(extensionsPath: string): Promise<UIExtension[]> {
    const extensionConfigPaths = await path.join(extensionsPath, `*/${configurationFileNames.extension.ui}`)
    const configPaths = await path.glob(extensionConfigPaths)

    const extensions = configPaths.map(async (configPath) => {
      const directory = path.dirname(configPath)
      const configuration = await this.parseConfigurationFile(UIExtensionConfigurationSchema, configPath)
      return {
        directory,
        configuration,
        buildDirectory: path.join(directory, 'build'),
        entrySourceFilePath: path.join(directory, 'src/index.js'),
      }
    })
    return Promise.all(extensions)
  }

  async loadFunctions(extensionsPath: string): Promise<FunctionExtension[]> {
    const functionConfigPaths = await path.join(extensionsPath, `*/${configurationFileNames.extension.function}`)
    const configPaths = await path.glob(functionConfigPaths)

    const functions = configPaths.map(async (configPath) => {
      const directory = path.dirname(configPath)
      const configuration = await this.parseConfigurationFile(FunctionExtensionConfigurationSchema, configPath)
      return {directory, configuration}
    })
    return Promise.all(functions)
  }

  async loadThemeExtensions(extensionsPath: string): Promise<ThemeExtension[]> {
    const themeConfigPaths = await path.join(extensionsPath, `*/${configurationFileNames.extension.theme}`)
    const configPaths = await path.glob(themeConfigPaths)

    const themeExtensions = configPaths.map(async (configPath) => {
      const directory = path.dirname(configPath)
      const configuration = await this.parseConfigurationFile(ThemeExtensionConfigurationSchema, configPath)
      return {directory, configuration}
    })
    return Promise.all(themeExtensions)
  }

  abortOrReport(errorMessage: string, fallback: any = null) {
    if (this.mode === 'strict') {
      throw new error.Abort(errorMessage)
    } else {
      this.errors.push(errorMessage)
      return fallback
    }
  }
}

export async function load(directory: string, mode: AppLoaderMode = 'strict'): Promise<App> {
  const loader = new AppLoader({directory, mode})
  return loader.loaded()
}
