import {functionTypegenJsonOutputSchema, type FunctionTypegenResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderFunctionTypegenResult(result: FunctionTypegenResult, json: boolean): void {
  if (json) outputResult(functionTypegenJsonOutputSchema.encode(result))
  else renderSuccess({headline: 'GraphQL types generated successfully.'})
}
