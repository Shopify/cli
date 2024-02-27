import {DraftExtensionsPushOptions, enableDeveloperPreview, ensureDraftExtensionsPushContext} from '../context.js'
import {installJavy} from '../function/build.js'
import {updateExtensionDraft} from '../dev/update-extension.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputSuccess} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

export async function draftExtensionsPush(draftExtensionsPushOptions: DraftExtensionsPushOptions) {
  const {app, partnersSession, remoteExtensionIds, remoteApp} = await ensureDraftExtensionsPushContext(
    draftExtensionsPushOptions,
  )

  await installJavy(app)

  await renderConcurrent({
    processes: app.allExtensions
      .filter((ext) => ext.specification.experience !== 'configuration')
      .map((extension) => {
        return {
          prefix: extension.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await extension.build({stderr, stdout, signal, app, environment: 'development'})
            const registrationId = remoteExtensionIds[extension.localIdentifier]
            if (!registrationId) {
              throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
            }
            await updateExtensionDraft({
              extension,
              token: partnersSession.token,
              apiKey: remoteApp.apiKey,
              registrationId,
              stdout,
              stderr,
            })
          },
        }
      }),
    showTimestamps: false,
  })

  if (draftExtensionsPushOptions.enableDeveloperPreview) {
    await enableDeveloperPreview({token: partnersSession.token, apiKey: remoteApp.apiKey})
    outputSuccess(`Enabled dev preview`)
  }
}
