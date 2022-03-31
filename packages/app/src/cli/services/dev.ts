import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'

interface DevOptions {
  appInfo: App
  apiKey?: string
  store?: string
  reset: boolean
  noTunnel: boolean
  noUpdate: boolean
}

async function dev(options: DevOptions) {
  const {app, store} = await ensureDevEnvironment(options)
  // Create tunnel etc...
}

export default dev
