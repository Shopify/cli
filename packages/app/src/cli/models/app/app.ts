import {file, error, path, schema, string, toml} from '@shopify/cli-kit'
import {blocks, configurationFileNames, genericConfigurationFileNames, extensions} from '$cli/constants'

export const HomeConfigurationFileNotFound = (directory: string) => {
  return new error.Abort(`Couldn't find ${configurationFileNames.home} in ${directory}`)
}

export const AppConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  id: schema.define.optional(schema.define.string()),
  scopes: schema.define.string().default(''),
})

export type AppConfiguration = schema.define.infer<typeof AppConfigurationSchema>

const ExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(extensions.types),
  metafields: schema.define
    .array(
      schema.define.object({
        namespace: schema.define.string(),
        key: schema.define.string(),
      }),
    )
    .default([]),
})

type ExtensionConfiguration = schema.define.infer<typeof ExtensionConfigurationSchema>

const FunctionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
})

type FunctionConfiguration = schema.define.infer<typeof FunctionConfigurationSchema>

interface AppFunction {
  configuration: FunctionConfiguration
  directory: string
}

export interface Extension {
  configuration: ExtensionConfiguration
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
  functions: AppFunction[]
  homes: Home[]
  extensions: Extension[]
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
    const functions = await this.loadFunctions()
    const extensions = await this.loadExtensions()
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
      functions,
      extensions,
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

  async loadExtensions(): Promise<Extension[]> {
    const extensionsPath = path.join(this.appDirectory, `${blocks.extensions.directoryName}/*`)
    const directories = await path.glob(extensionsPath, {onlyDirectories: true})
    return Promise.all(directories.map((directory) => this.loadExtension(directory)))
  }

  async loadExtension(directory: string): Promise<Extension> {
    const configurationPath = path.join(directory, blocks.extensions.configurationName)
    const configuration = await this.parseConfigurationFile(ExtensionConfigurationSchema, configurationPath)
    return {
      directory,
      configuration,
      buildDirectory: path.join(directory, 'build'),
      entrySourceFilePath: path.join(directory, 'src/index.js'),
    }
  }

  async loadFunctions(): Promise<AppFunction[]> {
    const functionsPath = path.join(this.appDirectory, `${blocks.functions.directoryName}/*`)
    const directories = await path.glob(functionsPath, {onlyDirectories: true})
    return Promise.all(directories.map((directory) => this.loadFunction(directory)))
  }

  async loadFunction(directory: string): Promise<AppFunction> {
    const configurationPath = path.join(directory, blocks.functions.configurationName)
    const configuration = await this.parseConfigurationFile(FunctionConfigurationSchema, configurationPath)

    return {directory, configuration}
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
