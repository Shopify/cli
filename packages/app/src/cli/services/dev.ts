import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'
import {output} from '@shopify/cli-kit'

interface DevOptions {
  app: App
  store?: string
}

async function dev({app, store}: DevOptions) {
  const info = await ensureDevEnvironment(app, store)
  output.info(`AppId: ${info.appId}, store: ${info.store}`)
  // Create tunnel etc...
}

export default dev
