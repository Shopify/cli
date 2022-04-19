import {file, error, path, schema, string, toml} from '@shopify/cli-kit'
import {blocks, configurationFileNames, genericConfigurationFileNames, extensions} from '$cli/constants'

export const HomeNotFoundError = (homeDirectory: string) => {
  return new error.Abort(`Couldn't find the home directory at ${homeDirectory}`)
}

export const HomeConfigurationFileNotFound = (configurationFilePath: string) => {
  return new error.Abort(`Couldn't find the home configuration file at ${configurationFilePath}`)
}

export const AppConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  id: schema.define.optional(schema.define.string()),
})

type AppConfiguration = schema.define.infer<typeof AppConfigurationSchema>

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

const ScriptConfigurationSchema = schema.define.object({
  name: schema.define.string(),
})

type ScriptConfiguration = schema.define.infer<typeof ScriptConfigurationSchema>

interface Script {
  configuration: ScriptConfiguration
  directory: string
}

export interface Extension {
  configuration: ExtensionConfiguration
  directory: string
  buildDirectory: string
}

export const HomeConfigurationSchema = schema.define.object({
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
  scripts: Script[]
  home: Home
  extensions: Extension[]
}

export async function load(directory: string): Promise<App> {
  if (!(await file.exists(directory))) {
    throw new error.Abort(`Couldn't find directory ${directory}`)
  }
  const configurationPath = await path.findUp(configurationFileNames.app, {
    cwd: directory,
    type: 'file',
  })
  if (!configurationPath) {
    throw new error.Abort(`Couldn't find the configuration file for ${directory}, are you in an app directory?`)
  }
  const configuration = await parseConfigurationFile(AppConfigurationSchema, configurationPath)
  const appDirectory = path.dirname(configurationPath)
  const scripts = await loadScripts(appDirectory)
  const extensions = await loadExtensions(appDirectory)
  const yarnLockPath = path.join(appDirectory, genericConfigurationFileNames.yarn.lockfile)
  const yarnLockExists = await file.exists(yarnLockPath)
  const pnpmLockPath = path.join(appDirectory, genericConfigurationFileNames.pnpm.lockfile)
  const pnpmLockExists = await file.exists(pnpmLockPath)
  let packageManager: PackageManager
  if (yarnLockExists) {
    packageManager = 'yarn'
  } else if (pnpmLockExists) {
    packageManager = 'pnpm'
  } else {
    packageManager = 'npm'
  }
  const home = await loadHome(appDirectory)

  return {
    directory: appDirectory,
    configuration,
    home,
    scripts,
    extensions,
    packageManager,
  }
}

async function loadHome(appDirectory: string): Promise<Home> {
  const homeDirectory = path.join(appDirectory, 'home')
  if (!(await file.exists(homeDirectory))) {
    throw HomeNotFoundError(homeDirectory)
  }
  const homeConfigurationFile = path.join(homeDirectory, configurationFileNames.home)
  if (!(await file.exists(homeConfigurationFile))) {
    throw HomeConfigurationFileNotFound(homeConfigurationFile)
  }
  const configuration = await parseConfigurationFile(HomeConfigurationSchema, homeConfigurationFile)
  return {directory: homeDirectory, configuration}
}

async function loadConfigurationFile(path: string): Promise<object> {
  if (!(await file.exists(path))) {
    throw new error.Abort(`Couldn't find the configuration file at ${path}`)
  }
  const configurationContent = await file.read(path)
  // Convert snake_case keys to camelCase before returning
  return Object.fromEntries(
    Object.entries(toml.decode(configurationContent)).map((kv) => [string.camelize(kv[0]), kv[1]]),
  )
}

async function parseConfigurationFile(schema: any, path: string) {
  const configurationObject = await loadConfigurationFile(path)
  const parseResult = schema.safeParse(configurationObject)
  if (!parseResult.success) {
    throw new error.Abort(`Invalid schema in ${path}:\n${JSON.stringify(parseResult.error.issues, null, 2)}`)
  }
  return parseResult.data
}

async function loadExtensions(rootDirectory: string): Promise<Extension[]> {
  const extensionsPath = path.join(rootDirectory, `${blocks.extensions.directoryName}/*`)
  const directories = await path.glob(extensionsPath, {onlyDirectories: true})
  return Promise.all(directories.map((directory) => loadExtension(directory)))
}

async function loadExtension(directory: string): Promise<Extension> {
  const configurationPath = path.join(directory, blocks.extensions.configurationName)
  const configuration = await parseConfigurationFile(ExtensionConfigurationSchema, configurationPath)
  return {directory, configuration, buildDirectory: path.join(directory, 'build')}
}

async function loadScripts(rootDirectory: string): Promise<Script[]> {
  const scriptsPath = path.join(rootDirectory, `${blocks.scripts.directoryName}/*`)
  const directories = await path.glob(scriptsPath, {onlyDirectories: true})
  return Promise.all(directories.map((directory) => loadScript(directory)))
}

async function loadScript(directory: string): Promise<Script> {
  const configurationPath = path.join(directory, blocks.scripts.configurationName)
  const configuration = await parseConfigurationFile(ScriptConfigurationSchema, configurationPath)

  return {directory, configuration}
}
