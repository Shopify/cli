import {createApp} from '../../../dev/select-app.js'
import {createStep, transition} from '../utils/utils.js'
import {isLegacyAppSchema} from '../../../../models/app/app.js'
import {configurationFileNames} from '../../../../constants.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {joinPath} from '@shopify/cli-kit/node/path'

export default createStep('newApp', newApp)

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function newApp(options: any) {
  const token = await ensureAuthenticatedPartners()
  const app = await createApp(options.organization, options.localApp.name, token, options)

  const nextOptions = {...options, remoteApp: app}

  if (!options.localApp?.configuration || (options.localApp && isLegacyAppSchema(options.localApp.configuration))) {
    await transition({
      step: 'writeFile',
      options: {...nextOptions, configFilePath: joinPath(options.directory, configurationFileNames.app)},
    })
  } else {
    await transition({step: 'chooseConfigName', options: nextOptions})
  }
}
