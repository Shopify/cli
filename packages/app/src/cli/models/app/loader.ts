import {
  UIExtension,
  ThemeExtension,
  FunctionExtension,
  Extension,
  GenericSpecification,
  findSpecificationForType,
} from './extensions.js'
import {AppConfigurationSchema, Web, WebConfigurationSchema, App, AppInterface, WebType} from './app.js'
import {configurationFileNames, dotEnvFileNames} from '../../constants.js'
import metadata from '../../metadata.js'
import {UIExtensionInstance, UIExtensionSpec} from '../extensions/ui.js'
import {ThemeExtensionInstance, ThemeExtensionSpec} from '../extensions/theme.js'
import {ThemeExtensionSchema, TypeSchema} from '../extensions/schemas.js'
import {FunctionInstance, FunctionSpec} from '../extensions/functions.js'
import {schema} from '@shopify/cli-kit/node/schema'
import {fileExists, readFile, glob, findPathUp} from '@shopify/cli-kit/node/fs'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {
  getDependencies,
  getPackageManager,
  getPackageName,
  usesWorkspaces as appUsesWorkspaces,
} from '@shopify/cli-kit/node/node-package-manager'
import {resolveFramework} from '@shopify/cli-kit/node/framework'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {camelize} from '@shopify/cli-kit/common/string'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {isShopify} from '@shopify/cli-kit/node/environment/local'
import {joinPath, dirname, basename} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, OutputMessage, outputToken} from '@shopify/cli-kit/node/output'

const defaultExtensionDirectory = 'extensions/*'

export type AppLoaderMode = 'strict' | 'report'

export class AppErrors {
  private errors: {
    [key: string]: OutputMessage
  } = {}

  addError(path: string, message: OutputMessage): void {
    this.errors[path] = message
  }

  getError(path: string) {
    return this.errors[path]
  }

  isEmpty() {
    return Object.keys(this.errors).length === 0
  }

  toJSON(): OutputMessage[] {
    return Object.values(this.errors)
  }
}

interface AppLoaderConstructorArgs {
  directory: string
  mode?: AppLoaderMode
  specificationsFetcher: () => Promise<GenericSpecification[]>
}

/**
 * Load the local app from the given directory and using the provided extensions/functions specifications.
 * If the App contains extensions not supported by the current specs and mode is strict, it will throw an error.
 */
export async function load(options: AppLoaderConstructorArgs): Promise<AppInterface> {
  const loader = new AppLoader(options)
  return loader.loaded()
}

class AppLoader {
  private directory: string
  private mode: AppLoaderMode
  private appDirectory = ''
  private configurationPath = ''
  private errors: AppErrors = new AppErrors()
  private specificationsFetcher: () => Promise<GenericSpecification[]>

  constructor({directory, mode, specificationsFetcher}: AppLoaderConstructorArgs) {
    this.mode = mode ?? 'strict'
    this.directory = directory
    this.specificationsFetcher = specificationsFetcher
  }

  async loaded() {
    this.appDirectory = await this.findAppDirectory()
    const configurationPath = await this.getConfigurationPath()
    const configuration = await this.parseConfigurationFile(AppConfigurationSchema, configurationPath)
    const dotenv = await this.loadDotEnv()
    const {functions, uiExtensions, themeExtensions, specifications} = await this.loadExtensions(
      configuration.extensionDirectories,
    )
    const usedCustomLayoutForExtensions = configuration.extensionDirectories !== undefined
    const packageJSONPath = joinPath(this.appDirectory, 'package.json')
    const name = await loadAppName(this.appDirectory)
    const nodeDependencies = await getDependencies(packageJSONPath)
    const packageManager = await getPackageManager(this.appDirectory)
    const {webs, usedCustomLayout: usedCustomLayoutForWeb} = await this.loadWebs(configuration.webDirectories)
    const usesWorkspaces = await appUsesWorkspaces(this.appDirectory)

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
      specifications,
      usesWorkspaces,
      dotenv,
    )

    if (!this.errors.isEmpty()) appClass.errors = this.errors

    await logMetadataForLoadedApp(appClass, {
      usedCustomLayoutForWeb,
      usedCustomLayoutForUIExtensions: usedCustomLayoutForExtensions,
      usedCustomLayoutForFunctionExtensions: usedCustomLayoutForExtensions,
      usedCustomLayoutForThemeExtensions: usedCustomLayoutForExtensions,
    })

    return appClass
  }

  async loadDotEnv(): Promise<DotEnvFile | undefined> {
    let dotEnvFile: DotEnvFile | undefined
    const dotEnvPath = joinPath(this.appDirectory, dotEnvFileNames.production)
    if (await fileExists(dotEnvPath)) {
      dotEnvFile = await readAndParseDotEnv(dotEnvPath)
    }
    return dotEnvFile
  }

  async findAppDirectory() {
    if (!(await fileExists(this.directory))) {
      throw new AbortError(outputContent`Couldn't find directory ${outputToken.path(this.directory)}`)
    }
    return dirname(await this.getConfigurationPath())
  }

  async getConfigurationPath() {
    if (this.configurationPath) return this.configurationPath

    const configurationPath = await findPathUp(configurationFileNames.app, {
      cwd: this.directory,
      type: 'file',
    })
    if (!configurationPath) {
      throw new AbortError(
        outputContent`Couldn't find the configuration file for ${outputToken.path(
          this.directory,
        )}, are you in an app directory?`,
      )
    }

    this.configurationPath = configurationPath
    return configurationPath
  }

  async loadWebs(webDirectories?: string[]): Promise<{webs: Web[]; usedCustomLayout: boolean}> {
    const defaultWebDirectory = '**'
    const webConfigGlobs = [...(webDirectories ?? [defaultWebDirectory])].map((webGlob) => {
      return joinPath(this.appDirectory, webGlob, configurationFileNames.web)
    })
    const webTomlPaths = await glob(webConfigGlobs)

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))

    const webTomlsInStandardLocation = await glob(joinPath(this.appDirectory, `web/**/${configurationFileNames.web}`))
    const usedCustomLayout = webDirectories !== undefined || webTomlsInStandardLocation.length !== webTomlPaths.length

    return {webs, usedCustomLayout}
  }

  async loadWeb(WebConfigurationFile: string): Promise<Web> {
    return {
      directory: dirname(WebConfigurationFile),
      configuration: await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile),
      framework: await resolveFramework(dirname(WebConfigurationFile)),
    }
  }

  async loadExtensions(extensionDirectories?: string[]) {
    const functionsConfigFilePaths = await this.getConfigFilesFromExtensionDirectories(
      [configurationFileNames.extension.function],
      extensionDirectories,
    )
    const uiConfigFilePaths = await this.getConfigFilesFromExtensionDirectories(
      [configurationFileNames.extension.ui],
      extensionDirectories,
    )
    const themeConfigFilePaths = await this.getConfigFilesFromExtensionDirectories(
      [configurationFileNames.extension.theme],
      extensionDirectories,
    )

    const extensionsCount = functionsConfigFilePaths.length + uiConfigFilePaths.length + themeConfigFilePaths.length
    if (extensionsCount === 0) return {functions: [], uiExtensions: [], themeExtensions: [], specifications: []}

    const specifications = (await this.specificationsFetcher()) ?? []

    const functions = await this.loadFunctions(functionsConfigFilePaths, specifications)
    const uiExtensions = await this.loadUIExtensions(uiConfigFilePaths, specifications)
    const themeExtensions = await this.loadThemeExtensions(themeConfigFilePaths, specifications)

    return {functions, uiExtensions, themeExtensions, specifications}
  }

  async loadConfigurationFile(
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = decodeToml,
  ): Promise<unknown> {
    if (!(await fileExists(filepath))) {
      return this.abortOrReport(
        outputContent`Couldn't find the configuration file at ${outputToken.path(filepath)}`,
        '',
        filepath,
      )
    }
    const configurationContent = await readFile(filepath)
    let configuration: object
    try {
      configuration = decode(configurationContent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // TOML errors have line, pos and col properties
      if (err.line && err.pos && err.col) {
        return this.abortOrReport(
          outputContent`Fix the following error in ${outputToken.path(filepath)}:\n${err.message}`,
          null,
          filepath,
        )
      } else {
        throw err
      }
    }
    // Convert snake_case keys to camelCase before returning
    return {
      ...Object.fromEntries(Object.entries(configuration).map((kv) => [camelize(kv[0]), kv[1]])),
    }
  }

  async parseConfigurationFile<TSchema extends schema.ZodType>(
    schema: TSchema,
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = decodeToml,
  ): Promise<schema.TypeOf<TSchema>> {
    const fallbackOutput = {} as schema.TypeOf<TSchema>

    const configurationObject = await this.loadConfigurationFile(filepath, decode)
    if (!configurationObject) return fallbackOutput

    const parseResult = schema.safeParse(configurationObject)

    if (!parseResult.success) {
      const formattedError = JSON.stringify(parseResult.error.issues, null, 2)
      return this.abortOrReport(
        outputContent`Fix a schema error in ${outputToken.path(filepath)}:\n${formattedError}`,
        fallbackOutput,
        filepath,
      )
    }
    return parseResult.data
  }

  async getConfigFilesFromExtensionDirectories(
    extensionConfigFileNames: string[],
    extensionDirectories?: string[],
  ): Promise<string[]> {
    const extensionConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].flatMap((extensionPath) => {
      return extensionConfigFileNames.map((extensionConfigFileName) =>
        joinPath(this.appDirectory, extensionPath, `${extensionConfigFileName}`),
      )
    })
    return glob(extensionConfigPaths)
  }

  async loadUIExtensions(configPaths: string[], specifications: GenericSpecification[]): Promise<UIExtension[]> {
    const extensions = configPaths.map(async (configurationPath) => {
      const directory = dirname(configurationPath)
      const fileContent = await readFile(configurationPath)
      const obj = decodeToml(fileContent)
      const {type} = TypeSchema.parse(obj)
      const specification = findSpecificationForType(specifications, type) as UIExtensionSpec | undefined

      if (!specification) {
        const isShopifolk = await isShopify()
        const shopifolkMessage = '\nYou might need to enable some beta flags on your Organization or App'
        this.abortOrReport(
          outputContent`Unknown extension type ${outputToken.yellow(type)} in ${outputToken.path(configurationPath)}. ${
            isShopifolk ? shopifolkMessage : ''
          }`,
          undefined,
          configurationPath,
        )
        return undefined
      }

      const configuration = await this.parseConfigurationFile(specification.schema, configurationPath)

      let entryPath
      if (specification.singleEntryPath) {
        entryPath = (
          await Promise.all(
            ['index']
              .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
              .flatMap((fileName) => [`src/${fileName}`, `${fileName}`])
              .map((relativePath) => joinPath(directory, relativePath))
              .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
          )
        ).find((sourcePath) => sourcePath !== undefined)
        if (!entryPath) {
          this.abortOrReport(
            outputContent`Couldn't find an index.{js,jsx,ts,tsx} file in the directories ${outputToken.path(
              directory,
            )} or ${outputToken.path(joinPath(directory, 'src'))}`,
            undefined,
            directory,
          )
        }
      }

      const extensionInstance = new UIExtensionInstance({
        configuration,
        configurationPath,
        entryPath: entryPath ?? '',
        directory,
        specification,
        remoteSpecification: undefined,
      })

      if (configuration.type) {
        const validateResult = await extensionInstance.validate()
        if (validateResult.isErr()) {
          this.abortOrReport(outputContent`\n${validateResult.error}`, undefined, configurationPath)
        }
      }
      return extensionInstance
    })

    return getArrayRejectingUndefined(await Promise.all(extensions))
  }

  async loadFunctions(configPaths: string[], specifications: GenericSpecification[]): Promise<FunctionExtension[]> {
    const allFunctions = configPaths.map(async (configurationPath) => {
      const directory = dirname(configurationPath)
      const fileContent = await readFile(configurationPath)
      const obj = decodeToml(fileContent)
      const {type} = TypeSchema.parse(obj)
      const specification = findSpecificationForType(specifications, type) as FunctionSpec | undefined
      if (!specification) {
        this.abortOrReport(
          outputContent`Unknown function type ${outputToken.yellow(type)} in ${outputToken.path(configurationPath)}`,
          undefined,
          configurationPath,
        )
        return undefined
      }

      const configuration = await this.parseConfigurationFile(specification.configSchema, configurationPath)

      return new FunctionInstance({configuration, configurationPath, specification, directory})
    })
    return getArrayRejectingUndefined(await Promise.all(allFunctions))
  }

  async loadThemeExtensions(configPaths: string[], specifications: GenericSpecification[]): Promise<ThemeExtension[]> {
    const extensions = configPaths.map(async (configurationPath) => {
      const directory = dirname(configurationPath)
      const configuration = await this.parseConfigurationFile(ThemeExtensionSchema, configurationPath)
      const specification = findSpecificationForType(specifications, 'theme') as ThemeExtensionSpec | undefined

      if (!specification) {
        this.abortOrReport(
          outputContent`Unknown theme type ${outputToken.yellow('theme')} in ${outputToken.path(configurationPath)}`,
          undefined,
          configurationPath,
        )
        return undefined
      }

      return new ThemeExtensionInstance({
        configuration,
        configurationPath,
        directory,
        remoteSpecification: undefined,
        specification,
        outputBundlePath: directory,
      })
    })

    return getArrayRejectingUndefined(await Promise.all(extensions))
  }

  abortOrReport<T>(errorMessage: OutputMessage, fallback: T, configurationPath: string): T {
    if (this.mode === 'strict') {
      throw new AbortError(errorMessage)
    } else {
      this.errors.addError(configurationPath, errorMessage)
      return fallback
    }
  }
}

export async function loadAppName(appDirectory: string): Promise<string> {
  const packageJSONPath = joinPath(appDirectory, 'package.json')
  return (await getPackageName(packageJSONPath)) ?? basename(appDirectory)
}

async function getProjectType(webs: Web[]): Promise<'node' | 'php' | 'ruby' | 'frontend' | undefined> {
  const backendWebs = webs.filter((web) => web.configuration.type === WebType.Backend)
  const frontendWebs = webs.filter((web) => web.configuration.type === WebType.Frontend)
  if (backendWebs.length > 1) {
    outputDebug('Unable to decide project type as multiple web backends')
    return
  } else if (backendWebs.length === 0 && frontendWebs.length > 0) {
    return 'frontend'
  } else if (backendWebs.length === 0) {
    outputDebug('Unable to decide project type as no web backend')
    return
  }
  const {directory} = backendWebs[0]!

  const nodeConfigFile = joinPath(directory, 'package.json')
  const rubyConfigFile = joinPath(directory, 'Gemfile')
  const phpConfigFile = joinPath(directory, 'composer.json')

  if (await fileExists(nodeConfigFile)) {
    return 'node'
  } else if (await fileExists(rubyConfigFile)) {
    return 'ruby'
  } else if (await fileExists(phpConfigFile)) {
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
  await metadata.addPublicMetadata(async () => {
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
      app_name_hash: hashString(app.name),
      app_path_hash: hashString(app.directory),
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
      env_package_manager_workspaces: app.usesWorkspaces,
    }
  })

  await metadata.addSensitiveMetadata(async () => {
    return {
      app_name: app.name,
    }
  })
}
