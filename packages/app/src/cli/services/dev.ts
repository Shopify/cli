import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'
import {output} from '@shopify/cli-kit'

interface DevOptions {
  appInfo: App
  store?: string
}

async function dev({appInfo}: DevOptions) {
  const {app, store} = await ensureDevEnvironment(appInfo)
  output.info(`AppId: ${info.appId}, store: ${info.store}`)
  // Create tunnel etc...
}

export default dev
