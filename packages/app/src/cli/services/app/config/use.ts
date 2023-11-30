import {getAppConfigurationFileName, loadAppConfiguration} from '../../../models/app/loader.js'
import {clearCurrentConfigFile, setCachedAppInfo} from '../../local-storage.js'
import {selectConfigFile} from '../../../prompts/config.js'
import {AppConfiguration} from '../../../models/app/app.js'
import {logMetadataForLoadedContext} from '../../context.js'
import {GetConfigQuerySchema, GetConfig} from '../../../api/graphql/get_config.js'
import {Specifications} from '../../../models/extensions/load-specifications.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {Result, err, ok} from '@shopify/cli-kit/node/result'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {formatPackageManagerCommand, outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export interface UseOptions {
  directory: string
  configName?: string
  reset?: boolean
  warningContent?: RenderAlertOptions
  shouldRenderSuccess?: boolean
  specifications: Specifications
}

export default async function use({
  directory,
  configName,
  warningContent,
  shouldRenderSuccess = true,
  reset = false,
  specifications,
}: UseOptions): Promise<string | undefined> {
  if (reset) {
    clearCurrentConfigFile(directory)
    const packageManager = await getPackageManager(directory)
    renderSuccess({
      headline: 'Cleared current configuration.',
      body: [
        'In order to set a new current configuration, please run',
        {command: formatPackageManagerCommand(packageManager, 'shopify app config use CONFIG_NAME')},
        {char: '.'},
      ],
    })
    return
  }

  if (warningContent) {
    renderWarning(warningContent)
  }

  const configFileName = (await getConfigFileName(directory, configName)).valueOrAbort()

  const configuration = await saveCurrentConfig({
    configFileName,
    directory,
    specifications,
  })

  if (shouldRenderSuccess) {
    renderSuccess({
      headline: `Using configuration file ${configFileName}`,
    })
  }

  await logMetadata(configuration)

  return configFileName
}

interface SaveCurrentConfigOptions {
  configFileName: string
  directory: string
  specifications: Specifications
}

export async function saveCurrentConfig({configFileName, directory, specifications}: SaveCurrentConfigOptions) {
  const {configuration} = await loadAppConfiguration({configName: configFileName, directory, specifications})

  if (configuration.client_id) {
    setCachedAppInfo({
      directory,
      configFile: configFileName,
    })

    return configuration
  } else {
    throw new AbortError(`Configuration file ${configFileName} needs a client_id.`)
  }
}

async function getConfigFileName(directory: string, configName?: string): Promise<Result<string, string>> {
  if (configName) {
    const configFile = getAppConfigurationFileName(configName)
    if (await fileExists(joinPath(directory, configFile))) {
      return ok(configFile)
    } else {
      return err(`Could not find configuration file ${configFile}`)
    }
  }
  return selectConfigFile(directory)
}

async function logMetadata(configuration: AppConfiguration) {
  const token = await ensureAuthenticatedPartners()
  const queryVariables = {apiKey: configuration.client_id}
  const queryResult: GetConfigQuerySchema = await partnersRequest(GetConfig, token, queryVariables)

  if (queryResult.app) {
    const {app} = queryResult

    await logMetadataForLoadedContext(app)
  } else {
    outputDebug("Couldn't find app for analytics. Make sure you have a valid client ID.")
  }
}
