import {
  UIExtension,
  ThemeExtension,
  FunctionExtension,
  UIExtensionConfigurationSchema,
  FunctionExtensionConfigurationSchema,
  FunctionExtensionMetadataSchema,
  ThemeExtensionConfigurationSchema,
} from './extensions.js'
import {AppConfigurationSchema, Web, WebConfigurationSchema, AppClass} from './app.js'
import {blocks, configurationFileNames, dotEnvFileNames, extensionGraphqlId} from '../../constants.js'
import {error, file, id, path, schema, string, toml, output} from '@shopify/cli-kit'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, getPackageManager, getPackageName} from '@shopify/cli-kit/node/node-package-manager'

export type AppLoaderMode = 'strict' | 'report'

export interface AppLoaderConstructorArgs {
  directory: string
  mode: AppLoaderMode
}

export class AppErrors {
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

export class AppLoader {
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
    const name = await getPackageName(packageJSONPath)
    const nodeDependencies = await getDependencies(packageJSONPath)
    const packageManager = await getPackageManager(this.appDirectory)
    const webs = await this.loadWebs()

    const appClass = new AppClass(
      name,
      'SHOPIFY_API_KEY',
      this.appDirectory,
      packageManager,
      configuration,
      configurationPath,
      nodeDependencies,
      webs,
      uiExtensions,
      themeExtensions,
      functions,
      dotenv,
      this.errors,
    )

    return appClass
  }

  async loadDotEnv(): Promise<DotEnvFile | undefined> {
    let dotEnvFile: DotEnvFile | undefined
    const dotEnvPath = path.join(this.appDirectory, dotEnvFileNames.production)
    if (await file.exists(dotEnvPath)) {
      dotEnvFile = await readAndParseDotEnv(dotEnvPath)
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
