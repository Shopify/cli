import {BaseProcess, DevProcessFunction} from './types.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {DevSession} from './dev-session/dev-session.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

interface DevSessionOptions {
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
}

export interface DevSessionProcessOptions extends DevSessionOptions {
  url: string
  bundlePath: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

export interface DevSessionProcess extends BaseProcess<DevSessionOptions> {
  type: 'dev-session'
}

export async function setupDevSessionProcess({
  app,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  return {
    type: 'dev-session',
    prefix: 'dev-session',
    function: pushUpdatesForDevSession,
    options: {
      app,
      apiKey,
      developerPlatformClient,
      ...options,
    },
  }
}

export const pushUpdatesForDevSession: DevProcessFunction<DevSessionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  options,
) => {
  const {appWatcher, devSessionStatusManager} = options
  const processOptions = {...options, stderr, stdout, signal, bundlePath: appWatcher.buildOutputPath}
  const devSession = new DevSession({...processOptions, devSessionStatusManager})
  await devSession.start()
}
