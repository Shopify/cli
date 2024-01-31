import {AppInterface, Web} from '../models/app/app.js'
import {lintRemix} from './lint/remix.js'
import {outputInfo} from '@shopify/cli-kit/node/output'

export async function lint(app: AppInterface): Promise<void> {
  const {webs} = app
  const remixApp = webs.find((web: Web) => web.framework === 'remix')
  if (!remixApp) {
    outputInfo('No remix app found, skipping linting')
  } else {
    return lintRemix(app, remixApp)
  }
}
