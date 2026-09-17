import {getCachedAppInfo} from './local-storage.js'
import {getAppConfigurationFileName} from '../models/app/config-file-naming.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

/** Resolve the app configuration filename without loading or linking the app. */
export function resolveDoctorConfigFileName(directory: string, configName?: string): string {
  return getAppConfigurationFileName(configName ?? getCachedAppInfo(directory)?.configFile)
}

/** Resolve the selected configuration and abort if that file is missing. */
export function requireDoctorConfigFileName(directory: string, configName?: string): string {
  const configFileName = resolveDoctorConfigFileName(directory, configName)
  const configPath = joinPath(directory, configFileName)

  // Do not fall back to another config: that would scan or describe a different app.
  if (!fileExistsSync(configPath)) {
    throw new AbortError(`Couldn't find app configuration at ${configPath}.`, null, [
      'Pass `--config <name>` to select an existing app configuration.',
    ])
  }

  return configFileName
}
