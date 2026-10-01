import {appFlags} from '../flags.js'
import {Flags} from '@oclif/core'

export const logsAccountFlags = {
  'no-prompt': Flags.boolean({
    description: 'Fail instead of prompting when no valid account session is available.',
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

export const logsScopeFlags = {
  path: Flags.string({description: 'The path to your app directory.', env: 'SHOPIFY_FLAG_PATH'}),
  config: appFlags.config,
  'client-id': Flags.string({
    description: 'The Client ID of your app. Defaults to the current app configuration.',
    env: 'SHOPIFY_FLAG_CLIENT_ID',
    exclusive: ['app', 'config', 'path'],
  }),
  app: Flags.string({
    env: 'SHOPIFY_FLAG_APP',
    description: 'Alias for --client-id.',
    exclusive: ['client-id', 'config', 'path'],
  }),
}

export const logsTypeFlag = Flags.string({
  env: 'SHOPIFY_FLAG_LOG_TYPE',
  description: 'Event type. Repeat to include multiple types. Discover values with shopify app logs types.',
  multiple: true,
})
