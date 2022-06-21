import {genericConfigurationFileNames} from '../constants'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {HydrogenConfig} from '@shopify/hydrogen/config'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {loadConfig} from '@shopify/hydrogen/load-config'
import {dependency, path, error as kitError, file} from '@shopify/cli-kit'

export interface HydrogenApp {
  name: string
  directory: string
  dependencyManager: dependency.DependencyManager
  configuration: HydrogenConfig
  nodeDependencies: {[key: string]: string}
  language: 'JavaScript' | 'TypeScript'
  errors?: AppErrors
}

interface AppLoaderConstructorArgs {
  directory: string
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

class HydrogenAppLoader {
  private directory: string
  private errors: AppErrors = new AppErrors()

  constructor({directory}: AppLoaderConstructorArgs) {
    this.directory = directory
  }

  async loaded() {
    if (!(await file.exists(this.directory))) {
      throw new kitError.Abort(`Couldn't find directory ${this.directory}`)
    }

    const {configuration} = await this.loadConfig()

    const yarnLockPath = path.join(this.directory, genericConfigurationFileNames.yarn.lockfile)
    const yarnLockExists = await file.exists(yarnLockPath)
    const pnpmLockPath = path.join(this.directory, genericConfigurationFileNames.pnpm.lockfile)
    const pnpmLockExists = await file.exists(pnpmLockPath)
    const packageJSONPath = path.join(this.directory, 'package.json')
    const name = await dependency.getPackageName(packageJSONPath)
    const nodeDependencies = await dependency.getDependencies(packageJSONPath)
    const tsConfigExists = await file.exists(path.join(this.directory, 'tsconfig.json'))
    const language = tsConfigExists && nodeDependencies.typescript ? 'TypeScript' : 'JavaScript'

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
      directory: this.directory,
      configuration,
      dependencyManager,
      nodeDependencies,
      language,
    }

    if (!this.errors.isEmpty()) app.errors = this.errors

    return app
  }

  async loadConfig() {
    const abortError = new kitError.Abort(`Couldn't find hydrogen configuration file`)

    try {
      const config = await loadConfig({root: this.directory})

      if (!config) {
        throw abortError
      }

      return config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      abortError.stack = error.stack
      throw abortError
    }
  }
}

export async function load(directory: string): Promise<HydrogenApp> {
  const loader = new HydrogenAppLoader({directory})

  return loader.loaded()
}
