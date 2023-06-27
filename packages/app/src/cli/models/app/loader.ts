import {
  AppConfigurationSchema,
  Web,
  WebConfigurationSchema,
  App,
  AppInterface,
  WebType,
  getAppScopes,
  isLegacyAppSchema,
  LegacyAppSchema,
  AppSchema,
  isCurrentAppSchema,
} from './app.js'
import {configurationFileNames, dotEnvFileNames} from '../../constants.js'
import metadata from '../../metadata.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {TypeSchema} from '../extensions/schemas.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {zod} from '@shopify/cli-kit/node/schema'
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
import {hashString} from '@shopify/cli-kit/node/crypto'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {joinPath, dirname, basename} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, OutputMessage, outputToken} from '@shopify/cli-kit/node/output'

const defaultExtensionDirectory = 'extensions/*'

export type AppLoaderMode = 'strict' | 'report'

type AbortOrReport = <T>(errorMessage: OutputMessage, fallback: T, configurationPath: string) => T

async function loadConfigurationFile(
  filepath: string,
  abortOrReport: AbortOrReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode: (input: any) => any = decodeToml,
): Promise<unknown> {
  if (!(await fileExists(filepath))) {
    return abortOrReport(
      outputContent`Couldn't find the configuration file at ${outputToken.path(filepath)}`,
      '',
      filepath,
    )
  }

  try {
    const configurationContent = await readFile(filepath)
    return decode(configurationContent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // TOML errors have line, pos and col properties
    if (err.line && err.pos && err.col) {
      return abortOrReport(
        outputContent`Fix the following error in ${outputToken.path(filepath)}:\n${err.message}`,
        null,
        filepath,
      )
    } else {
      throw err
    }
  }
}

export async function loadAppConfiguration<TSchema extends zod.ZodType>(
  filePath: string,
  abortOrReport: AbortOrReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode: (input: any) => any = decodeToml,
) {
  const fallbackOutput = {} as zod.TypeOf<TSchema>

  const configurationObject = await loadConfigurationFile(filePath, abortOrReport, decode)

  if (!configurationObject) return fallbackOutput

  let schema: typeof AppConfigurationSchema | typeof AppSchema | typeof LegacyAppSchema = AppConfigurationSchema

  if (isCurrentAppSchema(configurationObject, {strict: true})) schema = AppSchema
  if (isLegacyAppSchema(configurationObject, {strict: true})) schema = LegacyAppSchema

  const parseResult = schema?.safeParse(configurationObject)

  if (!parseResult.success) {
    const formattedError = JSON.stringify(parseResult.error.issues, null, 2)
    return abortOrReport(
      outputContent`Fix a schema error in ${outputToken.path(filePath)}:\n${formattedError}`,
      fallbackOutput,
      filePath,
    )
  }
  return parseResult.data
}

export async function parseConfigurationFile<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  abortOrReport: AbortOrReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode: (input: any) => any = decodeToml,
): Promise<zod.TypeOf<TSchema>> {
  const fallbackOutput = {} as zod.TypeOf<TSchema>

  const configurationObject = await loadConfigurationFile(filepath, abortOrReport, decode)

  if (!configurationObject) return fallbackOutput

  const parseResult = schema.safeParse(configurationObject)

  if (!parseResult.success) {
    const formattedError = JSON.stringify(parseResult.error.issues, null, 2)
    return abortOrReport(
      outputContent`Fix a schema error in ${outputToken.path(filepath)}:\n${formattedError}`,
      fallbackOutput,
      filepath,
    )
  }
  return parseResult.data
}

export function findSpecificationForType(specifications: ExtensionSpecification[], type: string) {
  return specifications.find(
    (spec) =>
      spec.identifier === type || spec.externalIdentifier === type || spec.additionalIdentifiers?.includes(type),
  )
}

export async function findSpecificationForConfig(
  specifications: ExtensionSpecification[],
  configurationPath: string,
  abortOrReport: AbortOrReport,
) {
  const fileContent = await readFile(configurationPath)
  const obj = decodeToml(fileContent)
  const {type} = TypeSchema.parse(obj)
  const specification = findSpecificationForType(specifications, type)

  if (!specification) {
    const isShopifolk = await isShopify()
    const shopifolkMessage = '\nYou might need to enable some beta flags on your Organization or App'
    abortOrReport(
      outputContent`Unknown extension type ${outputToken.yellow(type)} in ${outputToken.path(configurationPath)}. ${
        isShopifolk ? shopifolkMessage : ''
      }`,
      undefined,
      configurationPath,
    )
    return undefined
  }

  return specification
}

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
  configName?: string
  specifications: ExtensionSpecification[]
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
  private configName?: string
  private appDirectory = ''
  private configurationPath = ''
  private errors: AppErrors = new AppErrors()
  private specifications: ExtensionSpecification[]

  constructor({directory, configName, mode, specifications}: AppLoaderConstructorArgs) {
    this.mode = mode ?? 'strict'
    this.directory = directory
    this.specifications = specifications
    this.configName = configName
  }

  findSpecificationForType(type: string) {
    return findSpecificationForType(this.specifications, type)
  }

  parseConfigurationFile<TSchema extends zod.ZodType>(
    schema: TSchema,
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = decodeToml,
  ) {
    return parseConfigurationFile(schema, filepath, this.abortOrReport.bind(this), decode)
  }

  async loaded() {
    this.appDirectory = await this.findAppDirectory()
    const configurationPath = await this.getConfigurationPath()
    const configuration = await loadAppConfiguration(configurationPath, this.abortOrReport.bind(this), decodeToml)
    const dotenv = await this.loadDotEnv()

    const {allExtensions, usedCustomLayout} = await this.loadExtensions(configuration.extension_directories)

    const packageJSONPath = joinPath(this.appDirectory, 'package.json')
    const name = await loadAppName(this.appDirectory)
    const nodeDependencies = await getDependencies(packageJSONPath)
    const packageManager = await getPackageManager(this.appDirectory)
    const {webs, usedCustomLayout: usedCustomLayoutForWeb} = await this.loadWebs(configuration.web_directories)
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
      allExtensions,
      usesWorkspaces,
      dotenv,
    )

    if (!this.errors.isEmpty()) appClass.errors = this.errors

    await logMetadataForLoadedApp(appClass, {
      usedCustomLayoutForWeb,
      usedCustomLayoutForExtensions: usedCustomLayout,
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

    const configurationFileName = getAppConfigurationFileName(this.configName)
    const configurationPath = await findPathUp(configurationFileName, {
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
    webConfigGlobs.push(`!${joinPath(this.appDirectory, '**/node_modules/**')}`)
    const webTomlPaths = await glob(webConfigGlobs)

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))
    this.validateWebs(webs)

    const webTomlsInStandardLocation = await glob(joinPath(this.appDirectory, `web/**/${configurationFileNames.web}`))
    const usedCustomLayout = webDirectories !== undefined || webTomlsInStandardLocation.length !== webTomlPaths.length

    return {webs, usedCustomLayout}
  }

  validateWebs(webs: Web[]): void {
    ;[WebType.Backend, WebType.Frontend].forEach((webType) => {
      const websOfType = webs.filter((web) => web.configuration.roles.includes(webType))
      if (websOfType.length > 1) {
        this.abortOrReport(
          outputContent`You can only have one web with the ${outputToken.yellow(webType)} role in your app`,
          undefined,
          joinPath(websOfType[1]!.directory, configurationFileNames.web),
        )
      }
    })
  }

  async loadWeb(WebConfigurationFile: string): Promise<Web> {
    const config = await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile)
    const roles = new Set('roles' in config ? config.roles : [])
    if ('type' in config) roles.add(config.type)
    const {type, ...processedWebConfiguration} = {...config, roles: Array.from(roles), type: undefined}
    return {
      directory: dirname(WebConfigurationFile),
      configuration: processedWebConfiguration,
      framework: await resolveFramework(dirname(WebConfigurationFile)),
    }
  }

  async loadExtensions(
    extensionDirectories?: string[],
  ): Promise<{allExtensions: ExtensionInstance[]; usedCustomLayout: boolean}> {
    const extensionConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].map((extensionPath) => {
      return joinPath(this.appDirectory, extensionPath, '*.extension.toml')
    })
    extensionConfigPaths.push(`!${joinPath(this.appDirectory, '**/node_modules/**')}`)
    const configPaths = await glob(extensionConfigPaths)

    const extensions = configPaths.map(async (configurationPath) => {
      const directory = dirname(configurationPath)
      const specification = await findSpecificationForConfig(
        this.specifications,
        configurationPath,
        this.abortOrReport.bind(this),
      )

      if (!specification) return

      const configuration = await this.parseConfigurationFile(specification.schema, configurationPath)
      const entryPath = await this.findEntryPath(directory, specification)

      const extensionInstance = new ExtensionInstance({
        configuration,
        configurationPath,
        entryPath,
        directory,
        specification,
      })

      const validateResult = await extensionInstance.validate()
      if (validateResult.isErr()) {
        this.abortOrReport(outputContent`\n${validateResult.error}`, undefined, configurationPath)
      }

      return extensionInstance
    })

    const allExtensions = getArrayRejectingUndefined(await Promise.all(extensions))
    return {allExtensions, usedCustomLayout: extensionDirectories !== undefined}
  }

  async findEntryPath(directory: string, specification: ExtensionSpecification) {
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
    } else if (specification.identifier === 'function') {
      entryPath = (
        await Promise.all(
          ['src/index.js', 'src/index.ts', 'src/main.rs']
            .map((relativePath) => joinPath(directory, relativePath))
            .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
        )
      ).find((sourcePath) => sourcePath !== undefined)
    }
    return entryPath
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
  const backendWebs = webs.filter((web) => isWebType(web, WebType.Backend))
  const frontendWebs = webs.filter((web) => isWebType(web, WebType.Frontend))
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

function isWebType(web: Web, type: WebType): boolean {
  return web.configuration.roles.includes(type)
}

async function logMetadataForLoadedApp(
  app: App,
  loadingStrategy: {
    usedCustomLayoutForWeb: boolean
    usedCustomLayoutForExtensions: boolean
  },
) {
  await metadata.addPublicMetadata(async () => {
    const projectType = await getProjectType(app.webs)

    const extensionFunctionCount = app.allExtensions.filter((extension) => extension.isFunctionExtension).length
    const extensionUICount = app.allExtensions.filter((extension) => extension.isESBuildExtension).length
    const extensionThemeCount = app.allExtensions.filter((extension) => extension.isThemeExtension).length

    const extensionTotalCount = app.allExtensions.length

    const webBackendCount = app.webs.filter((web) => isWebType(web, WebType.Backend)).length
    const webBackendFramework =
      webBackendCount === 1 ? app.webs.filter((web) => isWebType(web, WebType.Backend))[0]?.framework : undefined
    const webFrontendCount = app.webs.filter((web) => isWebType(web, WebType.Frontend)).length

    const extensionsBreakdownMapping: {[key: string]: number} = {}
    for (const extension of app.allExtensions) {
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
      app_extensions_custom_layout: loadingStrategy.usedCustomLayoutForExtensions,
      app_extensions_function_any: extensionFunctionCount > 0,
      app_extensions_function_count: extensionFunctionCount,
      app_extensions_theme_any: extensionThemeCount > 0,
      app_extensions_theme_count: extensionThemeCount,
      app_extensions_ui_any: extensionUICount > 0,
      app_extensions_ui_count: extensionUICount,
      app_name_hash: hashString(app.name),
      app_path_hash: hashString(app.directory),
      app_scopes: JSON.stringify(
        getAppScopes(app.configuration)
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

export function getAppConfigurationFileName(config?: string) {
  if (config) {
    const validFileRegex = /^shopify\.app(\.\w+)?\.toml$/g
    if (validFileRegex.test(config)) {
      return config
    }

    return `shopify.app.${config}.toml`
  }

  return configurationFileNames.app
}
