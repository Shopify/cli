import {type AppConfigUseResult} from './use/types.js'
import {renderAppConfigUseResult} from './use/result.js'
import {getAppConfigurationFileName, getAppConfigurationContext} from '../../../models/app/loader.js'
import {clearCurrentConfigFile, setCachedAppInfo} from '../../local-storage.js'
import {selectConfigFile} from '../../../prompts/config.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderWarning} from '@shopify/cli-kit/node/ui'
import {Result, err, ok} from '@shopify/cli-kit/node/result'

export interface UseOptions {
  directory: string
  configName?: string
  reset?: boolean
  warningContent?: RenderAlertOptions
  shouldRenderSuccess?: boolean
  developerPlatformClient?: DeveloperPlatformClient
}

export default async function use({
  directory,
  configName,
  warningContent,
  shouldRenderSuccess = true,
  reset = false,
}: UseOptions): Promise<string | undefined> {
  // Compatibility adapter for configuration selection during other commands.
  if (warningContent && !reset) renderWarning(warningContent)
  const result = await useAppConfiguration({directory, configName, reset})
  if (reset || shouldRenderSuccess) await renderAppConfigUseResult(result, directory, 'text')
  return result.configFile === null ? undefined : basename(result.configFile)
}

export async function useAppConfiguration({
  directory,
  configName,
  reset = false,
}: Pick<UseOptions, 'directory' | 'configName' | 'reset'>): Promise<AppConfigUseResult> {
  if (reset) {
    clearCurrentConfigFile(directory)
    return {configFile: null, clientId: null}
  }
  const configFileName = (await getConfigFileName(directory, configName)).valueOrAbort()
  const {activeConfig} = await getAppConfigurationContext(directory, configFileName)
  setCurrentConfigPreference(activeConfig.file.content, {configFileName, directory})
  return {configFile: joinPath(directory, configFileName), clientId: activeConfig.file.content.client_id as string}
}

/**
 * Sets the preferred app configuration file to use from now on.
 *
 * Only reads `client_id` from the configuration — full schema validation
 * is deferred to the next command that actually loads the app.
 */
export function setCurrentConfigPreference(
  configuration: {client_id?: string},
  options: {
    configFileName: string
    directory: string
  },
): void {
  const {configFileName, directory} = options
  if (configuration.client_id) {
    setCachedAppInfo({
      directory,
      configFile: configFileName,
    })
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
