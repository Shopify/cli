import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'
import {output} from '@shopify/cli-kit'

interface DevOptions {
  appInfo: App
}

async function dev({appInfo}: DevOptions) {
  const {org, app, store} = await ensureDevEnvironment(appInfo)
  output.info(`Running dev with ${app.title} on ${store.shopName}`)
  log('Connecting to the platform...')
  await new Promise((resolve, reject) => setInterval(resolve, 1 * 1000))
  log(
    `Your app is available at: https://54b7-2003-fb-ef0b-39ff-990c-d5ba-10e2-ff79.ngrok.io/auth?shop=development-lifecycle-store.myshopify.com`,
  )
  await new Promise((resolve, reject) => setInterval(resolve, 20 * 1000))
}

function log(message: output.Message) {
  output.info(output.content`${output.token.green(`[shopify]: `)}${message.toString()}`)
}

export default dev
