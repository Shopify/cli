import {getCachedAppInfo} from './local-storage.js'
import {getAppConfigurationFileName} from '../models/app/config-file-naming.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {TomlFile, TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'

/** Resolve the submission target without loading, linking, or modifying the app. */
export async function resolveDoctorSubmitClientId(options: {
  directory: string
  clientId?: string
  configName?: string
}): Promise<string> {
  const {directory, clientId, configName} = options
  if (clientId !== undefined) {
    if (!clientId.trim()) {
      throw new AbortError('The --client-id value must be a non-empty string.', null, [
        'Pass `--client-id <client-id>` to select the app directly, or omit it to use an existing app configuration.',
      ])
    }
    return clientId
  }

  const configFileName = getAppConfigurationFileName(configName ?? getCachedAppInfo(directory)?.configFile)
  const configPath = joinPath(directory, configFileName)

  // Do not fall back to another config: that could submit diagnostics to a different app.
  if (!(await fileExists(configPath))) {
    throw new AbortError(`Couldn't find app configuration at ${configPath}.`, null, [
      'Pass `--config <name>` to select an existing app configuration, or `--client-id <client-id>` to select the app directly.',
    ])
  }

  let configFile: TomlFile
  try {
    configFile = await TomlFile.read(configPath)
  } catch (error) {
    if (!(error instanceof TomlFileError)) throw error
    throw new AbortError(`Couldn't read app configuration at ${configPath}: ${error.message}`, null, [
      'Fix the selected configuration, or pass `--config <name>` to select another file or `--client-id <client-id>` to select the app directly.',
    ])
  }

  const configClientId = configFile.content.client_id
  if (typeof configClientId !== 'string' || !configClientId.trim()) {
    throw new AbortError(`App configuration at ${configPath} must contain a non-empty string client_id.`, null, [
      'Pass `--client-id <client-id>` to select the app directly, or run `shopify app config link` to link the app configuration.',
    ])
  }

  return configClientId
}
