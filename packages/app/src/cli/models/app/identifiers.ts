import {getDotEnvFileName} from './loader.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {constantize} from '@shopify/cli-kit/common/string'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import type {AppInterface} from './app.js'

export interface IdentifiersExtensions {
  [localIdentifier: string]: string
}

export interface Identifiers {
  /** Application's API Key */
  app: string

  /**
   * The extensions' unique identifiers.
   */
  extensions: IdentifiersExtensions

  /**
   * The extensions' numeric identifiers (expressed as a string).
   */
  extensionIds: IdentifiersExtensions

  /**
   * The extensions' unique identifiers which uuid is not managed.
   */
  extensionsNonUuidManaged: IdentifiersExtensions
}

export type UuidOnlyIdentifiers = Omit<Identifiers, 'extensionIds' | 'extensionsNonUuidManaged'>
type UpdateAppIdentifiersCommand = 'dev' | 'deploy' | 'release'
interface UpdateAppIdentifiersOptions {
  app: AppInterface
  identifiers: UuidOnlyIdentifiers
  command: UpdateAppIdentifiersCommand
  developerPlatformClient: DeveloperPlatformClient
}

/**
 * Given an app and a set of identifiers, it persists the identifiers in the .env files.
 * @param options - Options.
 * @returns An copy of the app with the environment updated to reflect the updated identifiers.
 */
export async function updateAppIdentifiers(
  {app, identifiers, command, developerPlatformClient}: UpdateAppIdentifiersOptions,
  systemEnvironment = process.env,
): Promise<AppInterface> {
  if (developerPlatformClient.supportsAtomicDeployments) {
    // We can't update the TOML files in parallel because some extensions might share the same file
    for (const extension of app.allExtensions) {
      // eslint-disable-next-line no-await-in-loop
      await addUidToToml(extension)
    }
  }

  let dotenvFile = app.dotenv

  if (!dotenvFile) {
    dotenvFile = {
      path: joinPath(app.directory, getDotEnvFileName(app.configuration.path)),
      variables: {},
    }
  }
  const updatedVariables: {[key: string]: string} = {...(app.dotenv?.variables ?? {})}
  if (!systemEnvironment[app.idEnvironmentVariableName]) {
    updatedVariables[app.idEnvironmentVariableName] = identifiers.app
  }
  Object.keys(identifiers.extensions).forEach((identifier) => {
    const envVariable = `SHOPIFY_${constantize(identifier)}_ID`
    if (!systemEnvironment[envVariable]) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      updatedVariables[envVariable] = identifiers.extensions[identifier]!
    }
  })

  const contentHasChanged = JSON.stringify(dotenvFile.variables) !== JSON.stringify(updatedVariables)
  const writeToFile = contentHasChanged && (command === 'deploy' || command === 'release')
  dotenvFile.variables = updatedVariables

  if (writeToFile) {
    const dotEnvFileExists = await fileExists(dotenvFile.path)
    const envFileContent = dotEnvFileExists ? await readFile(dotenvFile.path) : ''
    const updatedEnvFileContent = patchEnvFile(envFileContent, updatedVariables)
    await writeFile(dotenvFile.path, updatedEnvFileContent)
  }

  // eslint-disable-next-line require-atomic-updates
  app.dotenv = dotenvFile
  return app
}

async function addUidToToml(extension: ExtensionInstance) {
  if (!extension.isUUIDStrategyExtension) return

  const tomlContents = await readFile(extension.configurationPath)
  const extensionConfig = decodeToml(tomlContents)
  const extensions = getPathValue(extensionConfig, 'extensions') as ExtensionInstance[]

  if ('uid' in extensionConfig) return
  if (extensions) {
    const currentExtension = extensions.find((ext) => ext.handle === extension.handle)
    if (currentExtension && 'uid' in currentExtension) return
  }

  let updatedTomlContents = tomlContents
  if (extensions?.length > 1) {
    // If the TOML has multiple extensions, we look for the correct handle to add the uid below
    const regex = new RegExp(`(\\n?(\\s*)handle\\s*=\\s*"${extension.handle}")`)
    updatedTomlContents = tomlContents.replace(regex, `$1\n$2uid = "${extension.uid}"`)
  } else {
    // If the TOML has only one extension, we add the uid before the type, which is always present
    if ('uid' in extensionConfig) return
    const regex = /\n?((\s*)type\s*=\s*"\S*")/
    updatedTomlContents = tomlContents.replace(regex, `$2\nuid = "${extension.uid}"\n$1`)
  }
  await writeFile(extension.configurationPath, updatedTomlContents)
}

interface GetAppIdentifiersOptions {
  app: AppInterface
}
/**
 * Given an app and a environment, it fetches the ids from the environment
 * and returns them.
 */
export function getAppIdentifiers(
  {app}: GetAppIdentifiersOptions,
  developerPlatformClient: DeveloperPlatformClient,
  systemEnvironment = process.env,
): Partial<UuidOnlyIdentifiers> {
  const envVariables = {
    ...app.dotenv?.variables,
    ...(systemEnvironment as {[variable: string]: string}),
  }
  const extensionsIdentifiers: {[key: string]: string} = {}
  const processExtension = (extension: ExtensionInstance) => {
    if (Object.keys(envVariables).includes(extension.idEnvironmentVariableName)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      extensionsIdentifiers[extension.localIdentifier] = envVariables[extension.idEnvironmentVariableName]!
    }
    if (developerPlatformClient.supportsAtomicDeployments) {
      extensionsIdentifiers[extension.localIdentifier] = extension.uid
    }
  }
  app.allExtensions.forEach(processExtension)

  return {
    app: envVariables[app.idEnvironmentVariableName],
    extensions: extensionsIdentifiers,
  }
}
