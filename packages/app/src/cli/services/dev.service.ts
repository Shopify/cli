import {ensureValidDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'

interface DevOptions {
  app: App
}

async function devInit({app}: DevOptions) {
  await ensureValidDevEnvironment(app)
}

export default devInit
