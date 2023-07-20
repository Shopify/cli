import {createApp} from '../../../dev/select-app.js'
import {transition} from '../utils/transition.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function newApp(options: any) {
  const token = await ensureAuthenticatedPartners()
  const app = await createApp(options.organization, options.localApp.name, token, options)

  const nextOptions = {...options, app}

  await transition({state: 'success', options: nextOptions})
}
