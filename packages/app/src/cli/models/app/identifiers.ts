import {getDotEnvFileName} from './loader.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {constantize} from '@shopify/cli-kit/common/string'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {deepCompare} from '@shopify/cli-kit/common/object'
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

type UuidOnlyIdentifiers = Omit<Identifiers, 'extensionIds' | 'extensionsNonUuidManaged'>
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
  {app, identifiers, command}: UpdateAppIdentifiersOptions,
  systemEnvironment = process.env,
): Promise<AppInterface> {
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

  const contentIsEqual = deepCompare(dotenvFile.variables, updatedVariables)
  const writeToFile = !contentIsEqual && (command === 'deploy' || command === 'release')
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

interface GetAppIdentifiersOptions {
  app: AppInterface
}
/**
 * Given an app and a environment, it fetches the ids from the environment
 * and returns them.
 */
export function getAppIdentifiers(
  {app}: GetAppIdentifiersOptions,
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
    extensionsIdentifiers[extension.localIdentifier] = extension.uid
  }
  app.allExtensions.forEach(processExtension)

  return {
    app: envVariables[app.idEnvironmentVariableName],
    extensions: extensionsIdentifiers,
  }
}
