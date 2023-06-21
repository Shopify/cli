import {getAppConfigurationFileName, load as loadApp} from '../../../models/app/loader.js'
import {setAppInfo} from '../../local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {OutputMessage} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface UseOptions {
  directory: string
  config?: string
}

export default async function use({directory, config}: UseOptions): Promise<void> {
  const configFileName = getAppConfigurationFileName(config)
  const configFilePath = joinPath(directory, configFileName)

  const configFileExists = await fileExists(configFilePath)
  if (!configFileExists) {
    abort(`Could not find configuration file ${configFileName}`)
  }

  const app = await loadApp({specifications: [], configName: configFileName, directory, mode: 'strict'})

  if (!app.configuration.client_id) {
    abort(`Configuration file ${configFileName} needs a client_id.`)
  }

  setAppInfo({
    directory,
    configFile: configFileName,
    appId: app.configuration.client_id,
  })

  renderSuccess({
    headline: `Using configuration file ${basename(configFilePath)}`,
  })
}

export const abort = (errorMessage: OutputMessage) => {
  throw new AbortError(errorMessage)
}
