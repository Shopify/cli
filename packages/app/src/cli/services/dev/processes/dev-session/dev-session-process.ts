import {DevSessionEventLog} from './dev-session-event-log.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DevSession} from './dev-session.js'
import {BaseProcess, DevProcessFunction} from '../types.js'
import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../../models/app/app.js'
import {AppEventWatcher} from '../../app-events/app-event-watcher.js'

export interface DevSessionProcessOptions {
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  apiKey: string
  url: string
  app: AppLinkedInterface
  organizationId: string
  appId: string
  appWatcher: AppEventWatcher
  appPreviewURL: string
  appLocalProxyURL: string
  devSessionStatusManager: DevSessionStatusManager
  eventLog?: DevSessionEventLog
}

export interface DevSessionProcess extends BaseProcess<DevSessionProcessOptions> {
  type: 'dev-session'
}

export async function setupDevSessionProcess({
  app,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionProcessOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  return {
    type: 'dev-session',
    prefix: 'app-preview',
    function: pushUpdatesForDevSession,
    options: {
      app,
      apiKey,
      developerPlatformClient,
      ...options,
    },
  }
}

export const pushUpdatesForDevSession: DevProcessFunction<DevSessionProcessOptions> = async (
  {stdout, abortSignal},
  options,
) => {
  await DevSession.start(options, stdout, abortSignal)
}
