import {autocorrectJsonOutputSchema, type AutocorrectResult} from './types.js'
import {autocorrectStatus} from '../constants.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export function presentAutocorrectResult(result: AutocorrectResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(autocorrectJsonOutputSchema.encode({enabled: result.enabled}))
    return
  }

  renderInfo({body: result.enabled ? autocorrectStatus.on : autocorrectStatus.off})
}
