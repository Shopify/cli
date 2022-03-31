import {ensureDevEnvironment} from './dev/environment'
import {createTunnel} from './dev/tunnel'
import {App} from '../models/app/app'
import {output} from '@shopify/cli-kit'

interface DevOptions {
  app: App
}

async function dev({app}: DevOptions) {
  await ensureDevEnvironment(app)
  const url = await createTunnel()
  if (!app.configuration.id) return
  await updateURLs(app.configuration.id, url)
  output.success(`Your app is available at: ${url}/auth?shop=development-lifecycle-store.myshopify.com`)
}

export default dev
