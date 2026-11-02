import {functionBuildJsonOutputSchema, type FunctionBuildResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderFunctionBuildResult(result: FunctionBuildResult, json: boolean): void {
  if (json) outputResult(functionBuildJsonOutputSchema.encode(result))
  else renderSuccess({headline: 'Function built successfully.'})
}
