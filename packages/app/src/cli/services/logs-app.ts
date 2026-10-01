import {type LogsQueryOptions} from './logs-query.js'
import {getAppConfigurationContext} from '../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd} from '@shopify/cli-kit/node/path'

export interface LogsScopeOptions extends Pick<LogsQueryOptions, 'noPrompt' | 'demo'> {
  clientId?: string
  path?: string
  config?: string
}

export async function resolveLogsApp(options: LogsScopeOptions): Promise<string> {
  if (options.clientId !== undefined) {
    if (!options.clientId.trim()) throw new AbortError('Provide a nonempty --client-id.')
    return options.clientId
  }
  const {activeConfig} = await getAppConfigurationContext(options.path ?? cwd(), options.config, {
    skipPrompts: options.noPrompt,
  })
  if (activeConfig.file.errors.length > 0) {
    throw new AbortError(activeConfig.file.errors.map((error) => error.message).join('\n'))
  }
  const clientId = activeConfig.file.content.client_id
  if (typeof clientId !== 'string' || !clientId.trim()) {
    throw new AbortError('Set client_id in your app configuration or pass --client-id.')
  }
  return clientId
}
