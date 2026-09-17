import {sourcesForApp} from './utils.js'
import {AppLogSourcesResult} from './sources/types.js'
import {AppInterface} from '../../models/app/app.js'

export function sources(app: AppInterface): AppLogSourcesResult {
  return sourcesForApp(app)
}
