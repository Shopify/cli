import {ensureDevEnvironment} from './dev/environment'
import {App} from '../models/app/app'

interface DevOptions {
  app: App
}

async function dev({app}: DevOptions) {
  await ensureDevEnvironment(app)
  // Create tunnel etc...
}

export default dev
