import {file, error, path, schema, string, toml} from '@shopify/cli-kit'

import {
  blocks,
  configurationFileNames,
  genericConfigurationFileNames,
  extensions,
} from '../constants'

const AppConfigurationSchema = schema.define.object({
  name: schema.define.string(),
})

type AppConfiguration = schema.define.infer<typeof AppConfigurationSchema>

const UIExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  extensionType: schema.define.enum(extensions.types),
})

type UIExtensionConfiguration = schema.define.infer<
  typeof UIExtensionConfigurationSchema
>

const ScriptConfigurationSchema = schema.define.object({
  name: schema.define.string(),
})

type ScriptConfiguration = schema.define.infer<typeof ScriptConfigurationSchema>

interface Script {
  configuration: ScriptConfiguration
  directory: string
}

interface UIExtension {
  configuration: UIExtensionConfiguration
  directory: string
}

type PackageManager = 'npm' | 'yarn' | 'pnpm'

export interface App {
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  scripts: Script[]
  uiExtensions: UIExtension[]
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
    throw new error.Abort(
      `Couldn't find the configuration file for ${directory}, are you in an app directory?`,
    )
  }
  const configuration = await parseConfigurationFile(
    AppConfigurationSchema,
    configurationPath,
  )
  const appDirectory = path.dirname(configurationPath)
  const scripts = await loadScripts(appDirectory)
  const uiExtensions = await loadExtensions(appDirectory)
  const yarnLockPath = path.join(
    appDirectory,
    genericConfigurationFileNames.yarn.lockfile,
  )
  const yarnLockExists = await file.exists(yarnLockPath)
  const pnpmLockPath = path.join(
    appDirectory,
    genericConfigurationFileNames.pnpm.lockfile,
  )
  const pnpmLockExists = await file.exists(pnpmLockPath)
  let packageManager: PackageManager
  if (yarnLockExists) {
    packageManager = 'yarn'
  } else if (pnpmLockExists) {
    packageManager = 'pnpm'
  } else {
    packageManager = 'npm'
  }

  return {
    directory: appDirectory,
    configuration,
    scripts,
    uiExtensions,
    packageManager,
  }
}

async function loadConfigurationFile(path: string): Promise<object> {
  if (!(await file.exists(path))) {
    throw new error.Abort(`Couldn't find the configuration file at ${path}`)
  }
  const configurationContent = await file.read(path)
  // Convert snake_case keys to camelCase before returning
  return Object.fromEntries(
    Object.entries(toml.parse(configurationContent)).map((kv) => [
      string.camelize(kv[0]),
      kv[1],
    ]),
  )
}

async function parseConfigurationFile(schema: any, path: string) {
  const configurationObject = await loadConfigurationFile(path)
  const parseResult = schema.safeParse(configurationObject)
  if (!parseResult.success) {
    throw new error.Abort(
      `Invalid schema in ${path}:\n${JSON.stringify(
        parseResult.error.issues,
        null,
        2,
      )}`,
    )
  }
  return parseResult.data
}

async function loadExtensions(rootDirectory: string): Promise<UIExtension[]> {
  const extensionsPath = path.join(
    rootDirectory,
    `${blocks.uiExtensions.directoryName}/*`,
  )
  const directories = await path.glob(extensionsPath, {onlyDirectories: true})
  return Promise.all(directories.map((directory) => loadExtension(directory)))
}

async function loadExtension(directory: string): Promise<UIExtension> {
  const configurationPath = path.join(
    directory,
    blocks.uiExtensions.configurationName,
  )
  const configuration = await parseConfigurationFile(
    UIExtensionConfigurationSchema,
    configurationPath,
  )
  return {directory, configuration}
}

async function loadScripts(rootDirectory: string): Promise<Script[]> {
  const scriptsPath = path.join(
    rootDirectory,
    `${blocks.scripts.directoryName}/*`,
  )
  const directories = await path.glob(scriptsPath, {onlyDirectories: true})
  return Promise.all(directories.map((directory) => loadScript(directory)))
}

async function loadScript(directory: string): Promise<Script> {
  const configurationPath = path.join(
    directory,
    blocks.scripts.configurationName,
  )
  const configuration = await parseConfigurationFile(
    ScriptConfigurationSchema,
    configurationPath,
  )

  return {directory, configuration}
}
