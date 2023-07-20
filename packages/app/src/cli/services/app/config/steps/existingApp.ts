/* eslint-disable eslint-comments/disable-enable-pair */
import {configurationFileNames} from '../../../../constants.js'
import {isLegacyAppSchema} from '../../../../models/app/app.js'
import {getAppConfigurationFileName} from '../../../../models/app/loader.js'
import {selectAppPrompt} from '../../../../prompts/dev.js'
import {fetchAppFromApiKey} from '../../../dev/fetch.js'
import {getCachedCommandInfo} from '../../../local-storage.js'
import {createStep, transition} from '../utils/utils.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export default createStep('existingApp', existingApp)

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function existingApp(options: any) {
  let configName

  const token = await ensureAuthenticatedPartners()
  const selectedAppApiKey = await selectAppPrompt(options.apps, options.organization.id, options.token, {
    directory: options?.directory,
  })

  const cache: any = getCachedCommandInfo()
  const fullSelectedApp = await fetchAppFromApiKey(selectedAppApiKey, token)

  const nextOptions = {...options, remoteApp: fullSelectedApp}

  if (cache?.tomls[selectedAppApiKey]) configName = cache?.tomls[selectedAppApiKey] as string

  if (options.configName) {
    configName = getAppConfigurationFileName(options.configName)
  }

  if (!options.localApp?.configuration || (options.localApp && isLegacyAppSchema(options.localApp.configuration))) {
    configName = configurationFileNames.app
  }

  if (configName) {
    await transition({state: 'success', options: nextOptions})
  } else {
    await transition({state: 'chooseConfigName', options: nextOptions})
  }
}
