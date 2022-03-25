import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'

interface DevOptions {
  app: App
}

async function devInit({app}: DevOptions) {
  await ensureDevEnvironment(app)
  // Create tunnel etc...
}

export default devInit
