import {DeployDraftOptions, enableDeveloperPreview, ensureDeployDraftContext} from './context.js'
import {installJavy} from './function/build.js'
import {updateExtensionDraft} from './dev/update-extension.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputSuccess} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

export async function deployDraft(deployDraftOptions: DeployDraftOptions) {
  const {app, partnersSession, remoteExtensionIds, remoteApp} = await ensureDeployDraftContext(deployDraftOptions)

  await installJavy(app)

  await renderConcurrent({
    processes: app.allExtensions.map((extension) => {
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

  if (deployDraftOptions.enableDeveloperPreview) {
    await enableDeveloperPreview({token: partnersSession.token, apiKey: remoteApp.apiKey})
    outputSuccess(`Enabled dev preview`)
  }
}
