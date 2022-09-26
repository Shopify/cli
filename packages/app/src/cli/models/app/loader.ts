import {
  UIExtension,
  ThemeExtension,
  FunctionExtension,
  FunctionExtensionConfigurationSchema,
  FunctionExtensionMetadataSchema,
  ThemeExtensionConfigurationSchema,
  UIExtensionConfigurationSupportedSchema,
  Extension,
  TypeSchema,
} from './extensions.js'
import {AppConfigurationSchema, Web, WebConfigurationSchema, App, AppInterface, WebType} from './app.js'
import {parseFile} from './parser.js'
import {configurationFileNames, dotEnvFileNames, extensionGraphqlId} from '../../constants.js'
import {mapUIExternalExtensionTypeToUIExtensionType} from '../../utilities/extensions/name-mapper.js'
import metadata from '../../metadata.js'
import {error, file, id, path, schema, string, toml, output} from '@shopify/cli-kit'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, getPackageManager, getPackageName} from '@shopify/cli-kit/node/node-package-manager'
import {resolveFramework} from '@shopify/cli-kit/node/framework'

const defaultExtensionDirectory = 'extensions/*'

export type AppLoaderMode = 'strict' | 'report'

export class AppErrors {
  private errors: {
    [key: string]: output.Message
  } = {}

  addError(path: string, message: output.Message): void {
    this.errors[path] = message
  }

  getError(path: string) {
    return this.errors[path]
  }

  isEmpty() {
    return Object.keys(this.errors).length === 0
  }

  toJSON(): output.Message[] {
    return Object.values(this.errors)
  }
}

export async function load(directory: string, mode: AppLoaderMode = 'strict'): Promise<AppInterface> {
  const loader = new AppLoader({directory, mode})
  return loader.loaded()
}

interface AppLoaderConstructorArgs {
  directory: string
  mode: AppLoaderMode
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
    const dotenv = await this.loadDotEnv()
    const {functions, usedCustomLayout: usedCustomLayoutForFunctionExtensions} = await this.loadFunctions(
      configuration.extensionDirectories,
    )
    const {uiExtensions, usedCustomLayout: usedCustomLayoutForUIExtensions} = await this.loadUIExtensions(
      configuration.extensionDirectories,
    )
    const {themeExtensions, usedCustomLayout: usedCustomLayoutForThemeExtensions} = await this.loadThemeExtensions(
      configuration.extensionDirectories,
    )
    const packageJSONPath = path.join(this.appDirectory, 'package.json')
    const name = (await getPackageName(packageJSONPath)) ?? path.basename(this.appDirectory)
    const nodeDependencies = await getDependencies(packageJSONPath)
    const packageManager = await getPackageManager(this.appDirectory)
    const {webs, usedCustomLayout: usedCustomLayoutForWeb} = await this.loadWebs()

    const appClass = new App(
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
    )

    if (!this.errors.isEmpty()) appClass.errors = this.errors

    await logMetadataForLoadedApp(appClass, {
      usedCustomLayoutForWeb,
      usedCustomLayoutForUIExtensions,
      usedCustomLayoutForFunctionExtensions,
      usedCustomLayoutForThemeExtensions,
    })

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

  async loadWebs(): Promise<{webs: Web[]; usedCustomLayout: boolean}> {
    const webTomlPaths = await path.glob(path.join(this.appDirectory, `**/${configurationFileNames.web}`))

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))

    const webTomlsInStandardLocation = await path.glob(
      path.join(this.appDirectory, `web/**/${configurationFileNames.web}`),
    )
    const usedCustomLayout = webTomlsInStandardLocation.length !== webTomlPaths.length

    return {webs, usedCustomLayout}
  }

  async loadWeb(WebConfigurationFile: string): Promise<Web> {
    return {
      directory: path.dirname(WebConfigurationFile),
      configuration: await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile),
      framework: await resolveFramework(path.dirname(WebConfigurationFile)),
    }
  }

  async parseConfigurationFile<TSchema extends schema.define.ZodType>(
    schema: TSchema,
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = toml.decode,
  ): Promise<schema.define.TypeOf<TSchema>> {
    const result = await parseFile(schema, filepath, decode)
    if (!result.isErr()) return result.value

    let message: output.Message
    switch (result.error.type) {
      case 'file_not_found':
        message = output.content`Couldn't find the configuration file at ${output.token.path(filepath)}`
        break
      case 'decode_error':
        message = output.content`Fix the following error in ${output.token.path(filepath)}:\n${result.error.message}`
        break
      case 'invalid_schema': {
        message = output.content`Fix a schema error in ${output.token.path(filepath)}:\n${result.error.message}`
        break
      }
      case 'unknown':
        message = output.content`Unkwnown error in ${output.token.path(filepath)}:\n${result.error.message}`
        break
    }
    const fallbackOutput = {} as schema.define.TypeOf<TSchema>
    return this.abortOrReport(message, fallbackOutput, filepath)
  }

  async loadUIExtensions(
    extensionDirectories?: string[],
  ): Promise<{uiExtensions: UIExtension[]; usedCustomLayout: boolean}> {
    const extensionConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].map((extensionPath) => {
      return path.join(this.appDirectory, extensionPath, `${configurationFileNames.extension.ui}`)
    })
    const configPaths = await path.glob(extensionConfigPaths)

    const extensions = configPaths.map(async (configurationPath) => {
      const directory = path.dirname(configurationPath)
      const type = await this.parseConfigurationFile(TypeSchema, configurationPath)
      const configurationSupported = await this.parseConfigurationFile(
        UIExtensionConfigurationSupportedSchema,
        configurationPath,
      )
      const configuration = {
        ...configurationSupported,
        type: mapUIExternalExtensionTypeToUIExtensionType(configurationSupported.type),
      }

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
        entrySourceFilePath: entrySourceFilePath ?? '',
        outputBundlePath: path.join(directory, 'dist/main.js'),
        localIdentifier: path.basename(directory),
        // The convention is that unpublished extensions will have a random UUID with prefix `dev-`
        devUUID: `dev-${id.generateRandomUUID()}`,
      }
    })
    return {uiExtensions: await Promise.all(extensions), usedCustomLayout: extensionDirectories !== undefined}
  }

  async loadFunctions(
    extensionDirectories?: string[],
  ): Promise<{functions: FunctionExtension[]; usedCustomLayout: boolean}> {
    const functionConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].map((extensionPath) => {
      return path.join(this.appDirectory, extensionPath, `${configurationFileNames.extension.function}`)
    })
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
    return {functions: await Promise.all(functions), usedCustomLayout: extensionDirectories !== undefined}
  }

  async loadThemeExtensions(
    extensionDirectories?: string[],
  ): Promise<{themeExtensions: ThemeExtension[]; usedCustomLayout: boolean}> {
    const themeConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].map((extensionPath) => {
      return path.join(this.appDirectory, extensionPath, `${configurationFileNames.extension.theme}`)
    })
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
    return {
      themeExtensions: await Promise.all(themeExtensions),
      usedCustomLayout: extensionDirectories !== undefined,
    }
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

async function getProjectType(webs: Web[]): Promise<'node' | 'php' | 'ruby' | 'frontend' | undefined> {
  const backendWebs = webs.filter((web) => web.configuration.type === WebType.Backend)
  const frontendWebs = webs.filter((web) => web.configuration.type === WebType.Frontend)
  if (backendWebs.length > 1) {
    output.debug('Unable to decide project type as multiple web backends')
    return
  } else if (backendWebs.length === 0 && frontendWebs.length > 0) {
    return 'frontend'
  } else if (backendWebs.length === 0) {
    output.debug('Unable to decide project type as no web backend')
    return
  }
  const {directory} = backendWebs[0]!

  const nodeConfigFile = path.join(directory, 'package.json')
  const rubyConfigFile = path.join(directory, 'Gemfile')
  const phpConfigFile = path.join(directory, 'composer.json')

  if (await file.exists(nodeConfigFile)) {
    return 'node'
  } else if (await file.exists(rubyConfigFile)) {
    return 'ruby'
  } else if (await file.exists(phpConfigFile)) {
    return 'php'
  }
  return undefined
}

async function logMetadataForLoadedApp(
  app: App,
  loadingStrategy: {
    usedCustomLayoutForWeb: boolean
    usedCustomLayoutForUIExtensions: boolean
    usedCustomLayoutForFunctionExtensions: boolean
    usedCustomLayoutForThemeExtensions: boolean
  },
) {
  await metadata.addPublic(async () => {
    const projectType = await getProjectType(app.webs)

    const extensionFunctionCount = app.extensions.function.length
    const extensionUICount = app.extensions.ui.length
    const extensionThemeCount = app.extensions.theme.length

    const extensionTotalCount = extensionFunctionCount + extensionUICount + extensionThemeCount

    const webBackendCount = app.webs.filter((web) => web.configuration.type === WebType.Backend).length
    const webBackendFramework =
      webBackendCount === 1
        ? app.webs.filter((web) => web.configuration.type === WebType.Backend)[0]?.framework
        : undefined
    const webFrontendCount = app.webs.filter((web) => web.configuration.type === WebType.Frontend).length

    const allExtensions: Extension[] = [...app.extensions.function, ...app.extensions.theme, ...app.extensions.ui]
    const extensionsBreakdownMapping: {[key: string]: number} = {}
    for (const extension of allExtensions) {
      if (extensionsBreakdownMapping[extension.type] === undefined) {
        extensionsBreakdownMapping[extension.type] = 1
      } else {
        extensionsBreakdownMapping[extension.type]++
      }
    }

    return {
      project_type: projectType,
      app_extensions_any: extensionTotalCount > 0,
      app_extensions_breakdown: JSON.stringify(extensionsBreakdownMapping),
      app_extensions_count: extensionTotalCount,
      app_extensions_custom_layout:
        loadingStrategy.usedCustomLayoutForFunctionExtensions ||
        loadingStrategy.usedCustomLayoutForThemeExtensions ||
        loadingStrategy.usedCustomLayoutForUIExtensions,
      app_extensions_function_any: extensionFunctionCount > 0,
      app_extensions_function_count: extensionFunctionCount,
      app_extensions_function_custom_layout: loadingStrategy.usedCustomLayoutForFunctionExtensions,
      app_extensions_theme_any: extensionThemeCount > 0,
      app_extensions_theme_count: extensionThemeCount,
      app_extensions_theme_custom_layout: loadingStrategy.usedCustomLayoutForThemeExtensions,
      app_extensions_ui_any: extensionUICount > 0,
      app_extensions_ui_count: extensionUICount,
      app_extensions_ui_custom_layout: loadingStrategy.usedCustomLayoutForUIExtensions,
      app_name_hash: string.hashString(app.name),
      app_path_hash: string.hashString(app.directory),
      app_scopes: JSON.stringify(
        app.configuration.scopes
          .split(',')
          .map((scope) => scope.trim())
          .sort(),
      ),
      app_web_backend_any: webBackendCount > 0,
      app_web_backend_count: webBackendCount,
      app_web_custom_layout: loadingStrategy.usedCustomLayoutForWeb,
      app_web_framework: webBackendFramework,
      app_web_frontend_any: webFrontendCount > 0,
      app_web_frontend_count: webFrontendCount,
    }
  })

  await metadata.addSensitive(async () => {
    return {
      app_name: app.name,
    }
  })
}
