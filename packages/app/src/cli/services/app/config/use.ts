import {getAppConfigurationFileName, load as loadApp} from '../../../models/app/loader.js'
import {clearCurrentConfigFile, setCurrentConfigFile} from '../../local-storage.js'
import {selectConfigFile} from '../../../prompts/config.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {Result, err, ok} from '@shopify/cli-kit/node/result'

export interface UseOptions {
  directory: string
  config?: string
  reset?: boolean
}

export default async function use({directory, config, reset = false}: UseOptions): Promise<void> {
  if (reset) {
    clearCurrentConfigFile(directory)
    renderSuccess({
      headline: 'Cleared current configuration.',
      body: ['In order to set a new current configuration, please run `shopify app config use CONFIG_NAME`.'],
    })
    return
  }

  const configFileName = (await getConfigFileName(directory, config)).valueOrAbort()
  const _configFilePath = (await getConfigFilePath(directory, configFileName)).valueOrAbort()

  await saveCurrentConfig({configFileName, directory})

  renderSuccess({
    headline: `Using configuration file ${configFileName}`,
  })
}

interface SaveCurrentConfigOptions {
  configFileName: string
  directory: string
}

export async function saveCurrentConfig({configFileName, directory}: SaveCurrentConfigOptions) {
  const app = await loadApp({specifications: [], configName: configFileName, directory, mode: 'strict'})

  if (!app.configuration.client_id) {
    throw new AbortError(`Configuration file ${configFileName} needs a client_id.`)
  }

  setCurrentConfigFile({
    directory,
    configFile: configFileName,
    appId: app.configuration.client_id,
  })
}

async function getConfigFileName(directory: string, config?: string): Promise<Result<string, string>> {
  if (config) return ok(getAppConfigurationFileName(config))
  return selectConfigFile(directory)
}

async function getConfigFilePath(directory: string, configFileName: string): Promise<Result<string, string>> {
  const configFilePath = joinPath(directory, configFileName)

  const configFileExists = await fileExists(configFilePath)
  if (configFileExists) {
    return ok(configFilePath)
  } else {
    return err(`Could not find configuration file ${configFileName}`)
  }
}
