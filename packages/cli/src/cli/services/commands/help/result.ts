import {helpJsonOutputSchema, type HelpResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'

export function presentHelpResult(result: HelpResult): void {
  outputResult(helpJsonOutputSchema.encode(result))
}
