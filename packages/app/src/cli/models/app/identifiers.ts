import {Extension} from './extensions.js'
import {dotEnvFileNames} from '../../constants.js'
import {path, string} from '@shopify/cli-kit'
import {writeDotEnv} from '@shopify/cli-kit/node/dot-env'
import type {AppInterface} from './app'

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
}

export type UuidOnlyIdentifiers = Omit<Identifiers, 'extensionIds'>
type UpdateAppIdentifiersCommand = 'dev' | 'deploy'
interface UpdateAppIdentifiersOptions {
  app: AppInterface
  identifiers: UuidOnlyIdentifiers
  command: UpdateAppIdentifiersCommand
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
      path: path.join(app.directory, dotEnvFileNames.production),
      variables: {},
    }
  }
  const updatedVariables: {[key: string]: string} = {...(app.dotenv?.variables ?? {})}
  if (!systemEnvironment[app.idEnvironmentVariableName]) {
    updatedVariables[app.idEnvironmentVariableName] = identifiers.app
  }
  Object.keys(identifiers.extensions).forEach((identifier) => {
    const envVariable = `SHOPIFY_${string.constantize(identifier)}_ID`
    if (!systemEnvironment[envVariable]) {
      updatedVariables[envVariable] = identifiers.extensions[identifier]!
    }
  })

  const write = JSON.stringify(dotenvFile.variables) !== JSON.stringify(updatedVariables) && command === 'deploy'
  dotenvFile.variables = updatedVariables
  if (write) {
    await writeDotEnv(dotenvFile)
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
  const processExtension = (extension: Extension) => {
    if (Object.keys(envVariables).includes(extension.idEnvironmentVariableName)) {
      extensionsIdentifiers[extension.localIdentifier] = envVariables[extension.idEnvironmentVariableName]!
    }
  }
  app.extensions.ui.forEach(processExtension)
  app.extensions.function.forEach(processExtension)
  app.extensions.theme.forEach(processExtension)

  return {
    app: envVariables[app.idEnvironmentVariableName],
    extensions: extensionsIdentifiers,
  }
}
