import {getAppConfigurationFileName, loadAppConfiguration} from '../../../models/app/loader.js'
import {clearCurrentConfigFile, setCachedAppInfo} from '../../local-storage.js'
import {selectConfigFile} from '../../../prompts/config.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {Result, err, ok} from '@shopify/cli-kit/node/result'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

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

  const result = await loadAppConfiguration({
    userProvidedConfigName: configFileName,
    directory,
  })

  if (result.configurationState.state === 'template-only') {
    throw new AbortError(`Configuration file ${configFileName} is not a valid app configuration file.`)
  }

  setCurrentConfigPreference({configFileName, directory})

  if (shouldRenderSuccess) {
    renderSuccess({
      headline: `Using configuration file ${configFileName}`,
    })
  }

  return configFileName
}

/**
 * Sets the prefered app configuration file to use from now on.
 *
 * @param configuration - The configuration taken from this file. Used to ensure we're not remembering a malformed or incomplete configuration.
 * @returns - Nothing, but does confirm that the configuration is an up to date one (and not fresh from a template).
 */
export function setCurrentConfigPreference(options: {configFileName: string; directory: string}) {
  const {configFileName, directory} = options
  setCachedAppInfo({
    directory,
    configFile: configFileName,
  })
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
