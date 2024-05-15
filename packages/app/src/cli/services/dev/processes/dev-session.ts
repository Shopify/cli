import {BaseProcess, DevProcessFunction} from './types.js'
import {installJavy} from '../../function/build.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppInterface} from '../../../models/app/app.js'
import {updateExtensionDraft} from '../update-extension.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'

interface DevSessionOptions {
  extensions: ExtensionInstance[]
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  proxyUrl: string
  localApp: AppInterface
}

export interface DevSessionProcess extends BaseProcess<DevSessionOptions> {
  type: 'dev-session'
}

export async function setupDevSessionProcess({
  localApp,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  const draftableExtensions = localApp.draftableExtensions
  if (draftableExtensions.length === 0) {
    return
  }

  return {
    type: 'dev-session',
    prefix: 'extensions',
    function: pushUpdatesForDevSession,
    options: {
      localApp,
      apiKey,
      developerPlatformClient,
      ...options,
      extensions: draftableExtensions,
    },
  }
}

export const pushUpdatesForDevSession: DevProcessFunction<DevSessionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  {extensions, developerPlatformClient, apiKey, proxyUrl, localApp: app},
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installJavy(app)

  async function refreshToken() {
    await developerPlatformClient.refreshToken()
  }

  // 1. Create Dev Session

  // 2. Watch current app.toml, watch changes in extension folders, trigger a dev session update

  const registrationId = ''

  await Promise.all(
    extensions.map(async (extension) => {
      await extension.build({app, stdout, stderr, useTasks: false, signal, environment: 'development'})
      // Initial draft update for each extension
      await updateExtensionDraft({extension, developerPlatformClient, apiKey, registrationId, stdout, stderr})
      // Watch for changes
      return setupExtensionWatcher({
        extension,
        app,
        url: proxyUrl,
        stdout,
        stderr,
        signal,
        onChange: async () => {
          // At this point the extension has already been built and is ready to be updated
          return performActionWithRetryAfterRecovery(
            async () =>
              updateExtensionDraft({extension, developerPlatformClient, apiKey, registrationId, stdout, stderr}),
            refreshToken,
          )
        },
      })
    }),
  )
}
