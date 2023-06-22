import {getAppConfigurationFileName, load as loadApp} from '../../../models/app/loader.js'
import {setAppInfo} from '../../local-storage.js'
import {selectConfigFile} from '../../../prompts/config.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface UseOptions {
  directory: string
  config?: string
}

export default async function use({directory, config}: UseOptions): Promise<void> {
  const configFileName = await getConfigFileName(directory, config)

  if (!configFileName) {
    throw new AbortError('Could not find any shopify.app.toml file in the directory.')
  }

  const configFilePath = joinPath(directory, configFileName)

  const configFileExists = await fileExists(configFilePath)
  if (!configFileExists) {
    throw new AbortError(`Could not find configuration file ${configFileName}`)
  }

  await saveCurrentConfig({configFileName, directory})

  renderSuccess({
    headline: `Using configuration file ${configFileName}`,
  })
}

interface SaveCurrentConfigOptions {
  configFileName: string
  directory: string
}

async function saveCurrentConfig({configFileName, directory}: SaveCurrentConfigOptions) {
  const app = await loadApp({specifications: [], configName: configFileName, directory, mode: 'strict'})

  if (!app.configuration.client_id) {
    throw new AbortError(`Configuration file ${configFileName} needs a client_id.`)
  }

  setAppInfo({
    directory,
    configFile: configFileName,
    appId: app.configuration.client_id,
  })
}

async function getConfigFileName(directory: string, config?: string): Promise<string | undefined> {
  if (config) return getAppConfigurationFileName(config)

  return selectConfigFile(directory)
}
