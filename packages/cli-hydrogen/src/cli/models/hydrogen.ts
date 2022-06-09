import {HydrogenConfig} from './types'
import {configurationFileNames, genericConfigurationFileNames, supportedConfigExtensions} from '../constants'
import {dependency, path, file, error} from '@shopify/cli-kit'
import {createServer} from 'vite'

export interface HydrogenApp {
  name: string
  directory: string
  dependencyManager: dependency.DependencyManager
  configuration: HydrogenConfig
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  language: 'javascript' | 'typescript'
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
    const configuration = await this.loadConfigurationFile<HydrogenConfig>(configurationPath)
    const yarnLockPath = path.join(this.appDirectory, genericConfigurationFileNames.yarn.lockfile)
    const yarnLockExists = await file.exists(yarnLockPath)
    const pnpmLockPath = path.join(this.appDirectory, genericConfigurationFileNames.pnpm.lockfile)
    const pnpmLockExists = await file.exists(pnpmLockPath)
    const packageJSONPath = path.join(this.appDirectory, 'package.json')
    const name = await dependency.getPackageName(packageJSONPath)
    const nodeDependencies = await dependency.getDependencies(packageJSONPath)
    const tsConfigExists = await file.exists(path.join(this.appDirectory, 'tsconfig.json'))
    const language = tsConfigExists && nodeDependencies.typescript ? 'typescript' : 'javascript'

    let dependencyManager: dependency.DependencyManager
    if (yarnLockExists) {
      dependencyManager = 'yarn'
    } else if (pnpmLockExists) {
      dependencyManager = 'pnpm'
    } else {
      dependencyManager = 'npm'
    }

    const app: HydrogenApp = {
      name,
      directory: this.appDirectory,
      configuration,
      configurationPath,
      dependencyManager,
      nodeDependencies,
      language,
    }
    if (!this.errors.isEmpty()) app.errors = this.errors

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

    const promises = supportedConfigExtensions.map((ext) =>
      path.findUp([configurationFileNames.hydrogen, ext].join('.'), {
        cwd: this.directory,
        type: 'file',
      }),
    )

    const configurationPathResults = await Promise.all(promises)

    const configurationPath = configurationPathResults.find((result) => result !== undefined)

    if (!configurationPath) {
      throw new error.Abort(`Couldn't find the configuration file for ${this.directory}, are you in an app directory?`)
    }

    this.configurationPath = configurationPath
    return configurationPath
  }

  async loadConfigurationFile<T>(filepath: string): Promise<T> {
    const server = await createServer({
      server: {middlewareMode: 'ssr'},
    })

    const config = (await server.ssrLoadModule(filepath)).default

    await server.close()

    return config
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

export async function load(directory: string, mode: AppLoaderMode = 'strict'): Promise<HydrogenApp> {
  const loader = new AppLoader({directory, mode})
  return loader.loaded()
}
