import {BaseProcess, DevProcessFunction} from './types.js'
import {updateExtensionDraft} from '../update-extension.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching, ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {installJavy} from '../../function/build.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export interface DraftableExtensionOptions {
  extensions: ExtensionInstance[]
  token: string
  apiKey: string
  remoteExtensionIds: {[key: string]: string}
  proxyUrl: string
  localApp: AppInterface
}

export interface DraftableExtensionProcess extends BaseProcess<DraftableExtensionOptions> {
  type: 'draftable-extension'
}

export const pushUpdatesForDraftableExtensions: DevProcessFunction<DraftableExtensionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  {extensions, token, apiKey, remoteExtensionIds: remoteExtensions, proxyUrl, localApp: app},
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installJavy(app)

  let currentToken = token
  async function refreshToken() {
    const newToken = await ensureAuthenticatedPartners([], process.env, {noPrompt: true})
    if (newToken) currentToken = newToken
  }

  await Promise.all(
    extensions.map(async (extension) => {
      await extension.build({app, stdout, stderr, useTasks: false, signal, environment: 'development'})
      const registrationId = remoteExtensions[extension.localIdentifier]
      if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
      // Initial draft update for each extension
      await updateExtensionDraft({extension, token: currentToken, apiKey, registrationId, stdout, stderr})
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
            async () => updateExtensionDraft({extension, token: currentToken, apiKey, registrationId, stdout, stderr}),
            refreshToken,
          )
        },
      })
    }),
  )
}

export async function setupDraftableExtensionsProcess({
  localApp,
  apiKey,
  token,
  remoteApp,
  ...options
}: Omit<DraftableExtensionOptions, 'remoteExtensionIds' | 'extensions'> & {
  remoteApp: PartnersAppForIdentifierMatching
}): Promise<DraftableExtensionProcess | undefined> {
  // it would be good if this process didn't require the full local & remote app instances
  const draftableExtensions = localApp.draftableExtensions
  if (draftableExtensions.length === 0) {
    return
  }
  const prodEnvIdentifiers = getAppIdentifiers({app: localApp})

  const {extensionIds: remoteExtensionIds, extensions: extensionsUuids} = await ensureDeploymentIdsPresence({
    app: localApp,
    partnersApp: remoteApp,
    appId: apiKey,
    appName: remoteApp.title,
    force: true,
    release: true,
    token,
    envIdentifiers: prodEnvIdentifiers,
    includeDraftExtensions: true,
  })

  // Update the local app with the remote extension UUIDs.
  // Extensions are initialized with a random dev UUID when running the dev command
  // which is sent over WS messages for live reload in dev preview of UI Extensions.
  localApp.updateExtensionUUIDS(extensionsUuids)

  return {
    type: 'draftable-extension',
    prefix: 'extensions',
    function: pushUpdatesForDraftableExtensions,
    options: {
      localApp,
      apiKey,
      token,
      ...options,
      extensions: draftableExtensions,
      remoteExtensionIds,
    },
  }
}
