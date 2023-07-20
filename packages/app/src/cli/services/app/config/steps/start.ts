/* eslint-disable @typescript-eslint/no-explicit-any */
import {configurationFileNames} from '../../../../constants.js'
import {EmptyApp} from '../../../../models/app/app.js'
import {loadApp} from '../../../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../../../models/extensions/load-specifications.js'
import {LinkOptions} from '../link.js'
import {transition} from '../utils/transition.js'
import {fetchOrgsAppsAndStores, selectOrg} from '../../../context.js'
import {createAsNewAppPrompt} from '../../../../prompts/dev.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export async function start(options: any) {
  const localApp = await loadAppConfigFromDefaultToml(options)
  const token = await ensureAuthenticatedPartners()
  const orgId = await selectOrg(token)
  const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
  const createNewApp = await createAsNewAppPrompt()

  const nextOptions = {...options, organization, apps, localApp}

  if (createNewApp) {
    await transition({state: 'newApp', options: nextOptions})
  } else {
    await transition({state: 'existingApp', options: nextOptions})
  }
}

async function loadAppConfigFromDefaultToml(options: LinkOptions): Promise<unknown> {
  try {
    const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      configName: configurationFileNames.app,
    })
    return app
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return new EmptyApp()
  }
}
