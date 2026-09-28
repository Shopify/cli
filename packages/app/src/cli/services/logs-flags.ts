import {operationFlags} from '../flags.js'
import {Flags} from '@oclif/core'

export const logsApiFlags = {
  api: Flags.string({
    description: 'The logs API to call.',
    options: ['app-logs'],
    default: 'app-logs',
  }),
  variables: operationFlags.variables,
  'variable-file': operationFlags['variable-file'],
  'no-prompt': Flags.boolean({
    description: 'Fail instead of prompting for authentication when no valid session is available.',
    env: 'SHOPIFY_FLAG_NO_PROMPT',
    default: false,
  }),
  demo: Flags.boolean({
    env: 'SHOPIFY_FLAG_DEMO',
    hidden: true,
    default: false,
    description: 'Use the loopback development server with local account authentication.',
  }),
}
