import {ensureDevEnvironment} from './dev/environment'
import {updateURLs} from './dev/update-urls'
import {createTunnel} from './dev/tunnel'
import {App} from '../models/app/app'
import {output} from '@shopify/cli-kit'

interface DevOptions {
  appInfo: App
}

async function dev({app}: DevOptions) {
  await ensureDevEnvironment(app)
  const url = await createTunnel()
  if (!app.configuration.id) return
  await updateURLs(app.configuration.id, url)
  output.success(`Your app is available at: ${url}/auth?shop=development-lifecycle-store.myshopify.com`)

  const {org, app, store} = await ensureDevEnvironment(appInfo)
  output.info(`Running dev with ${app.title} on ${store.shopName}`)
//   log('Connecting to the platform...')
  await new Promise((resolve, reject) => setInterval(resolve, 1 * 1000))
//   log(
//     `Your app is available at: https://54b7-2003-fb-ef0b-39ff-990c-d5ba-10e2-ff79.ngrok.io/auth?shop=development-lifecycle-store.myshopify.com`,
//   )
  await new Promise((resolve, reject) => setInterval(resolve, 20 * 1000))
}

export default dev
