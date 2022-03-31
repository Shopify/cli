import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'

interface DevOptions {
  appInfo: App
  store?: string
}

async function dev({appInfo}: DevOptions) {
  const {app, store} = await ensureDevEnvironment(appInfo)
  // Create tunnel etc...
}

export default dev
