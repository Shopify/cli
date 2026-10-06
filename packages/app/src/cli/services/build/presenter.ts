import {appBuildJsonOutputSchema, type AppBuildResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function presentAppBuildResult(result: AppBuildResult, json: boolean): void {
  if (json) {
    outputResult(appBuildJsonOutputSchema.encode({status: result.status}))
  } else {
    renderSuccess({headline: [{userInput: result.appName}, 'built!']})
  }
}
