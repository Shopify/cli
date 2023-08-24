import {BaseProcess, DevProcessFunction} from './types.js'
import {updateExtensionDraft} from '../update-extension.js'
import {setupConfigWatcher, setupDraftableExtensionBundler, setupFunctionWatcher} from '../extension/bundler.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching, ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface DraftableExtensionOptions {
  extensions: ExtensionInstance[]
  token: string
  apiKey: string
  unifiedDeployment: boolean
  remoteExtensionIds: {[key: string]: string}
  proxyUrl: string
  localApp: AppInterface
}

export interface DraftableExtensionProcess extends BaseProcess<DraftableExtensionOptions> {
  type: 'draftable-extension'
}

export const pushUpdatesForDraftableExtensions: DevProcessFunction<DraftableExtensionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  {extensions, token, apiKey, unifiedDeployment, remoteExtensionIds: remoteExtensions, proxyUrl, localApp: app},
) => {
  // Functions will only be passed to this target if unified deployments are enabled
  // ESBuild will take care of triggering an initial build & upload for the extensions with ESBUILD feature.
  // For the rest we need to manually upload an initial draft.
  const initialDraftExtensions = extensions.filter((ext) => !ext.isESBuildExtension)
  await Promise.all(
    initialDraftExtensions.map(async (extension) => {
      await extension.build({app, stdout, stderr, useTasks: false, signal})
      const registrationId = remoteExtensions[extension.localIdentifier]
      if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
      await updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr, unifiedDeployment})
    }),
  )

  await Promise.all(
    extensions
      .map((extension) => {
        const registrationId = remoteExtensions[extension.localIdentifier]
        if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)

        const actions = [
          setupConfigWatcher({
            extension,
            token,
            apiKey,
            registrationId,
            stdout,
            stderr,
            signal,
            unifiedDeployment,
          }),
        ]

        // Only extensions with esbuild feature should be watched using esbuild
        if (extension.features.includes('esbuild')) {
          actions.push(
            setupDraftableExtensionBundler({
              extension,
              app,
              url: proxyUrl,
              token,
              apiKey,
              registrationId,
              stderr,
              stdout,
              signal,
              unifiedDeployment,
            }),
          )
        }

        // watch for function changes that require a build and push
        if (extension.isFunctionExtension) {
          actions.push(
            setupFunctionWatcher({
              extension,
              app,
              stdout,
              stderr,
              signal,
              token,
              apiKey,
              registrationId,
              unifiedDeployment,
            }),
          )
        }

        return actions
      })
      .flat(),
  )
}

export async function setupDraftableExtensionsProcess({
  unifiedDeployment,
  localApp,
  apiKey,
  token,
  remoteApp,
  ...options
}: Omit<DraftableExtensionOptions, 'remoteExtensionIds' | 'extensions'> & {
  remoteApp: PartnersAppForIdentifierMatching
}): Promise<DraftableExtensionProcess | undefined> {
  // it would be good if this process didn't require the full local & remote app instances
  const allExtensions = localApp.allExtensions
  const draftableExtensions = allExtensions.filter((ext) => ext.isDraftable(unifiedDeployment))
  if (draftableExtensions.length === 0) {
    return
  }
  const deploymentMode = unifiedDeployment ? 'unified' : 'legacy'
  const prodEnvIdentifiers = getAppIdentifiers({app: localApp})

  const {extensionIds: remoteExtensionIds} = await ensureDeploymentIdsPresence({
    app: localApp,
    partnersApp: remoteApp,
    appId: apiKey,
    appName: remoteApp.title,
    force: true,
    deploymentMode,
    token,
    envIdentifiers: prodEnvIdentifiers,
  })

  return {
    type: 'draftable-extension',
    prefix: 'extensions',
    function: pushUpdatesForDraftableExtensions,
    options: {
      unifiedDeployment,
      localApp,
      apiKey,
      token,
      ...options,
      extensions: draftableExtensions,
      remoteExtensionIds,
    },
  }
}
