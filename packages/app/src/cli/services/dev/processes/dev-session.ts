import {BaseProcess, DevProcessFunction} from './types.js'
import {installJavy} from '../../function/build.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppInterface} from '../../../models/app/app.js'
import {updateExtensionDraft} from '../update-extension.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {bundleAndBuildExtensions} from '../../deploy/bundle.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {inTemporaryDirectory, mkdir, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {formData} from '@shopify/cli-kit/node/http'
import {Writable} from 'stream'

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

  await Promise.all(
    extensions.map(async (extension) => {
      await extension.build({app, stdout, stderr, useTasks: false, signal, environment: 'development'})
    }),
  )

  // 0. Create app manifest and build extensions

  // 1. Request GCS URL

  // 2. Create Dev Session

  // 3. Watch current app.toml, watch changes in extension folders, trigger a dev session update

  const manifest = await app.manifest()

  console.log(JSON.stringify(manifest, null, 2))

  await buildAndBundle(app, developerPlatformClient, apiKey, stderr)

  await Promise.all(
    extensions.map(async (extension) => {
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
            async () => buildAndBundle(app, developerPlatformClient, apiKey, stderr),
            refreshToken,
          )
        },
      })
    }),
  )
}

async function buildAndBundle(
  app: AppInterface,
  developerPlatformClient: DeveloperPlatformClient,
  apiKey: string,
  stderr: Writable,
) {
  await inTemporaryDirectory(async (tmpDir) => {
    const bundlePath = joinPath(tmpDir, `bundle.zip`)
    await mkdir(dirname(bundlePath))
    await bundleAndBuildExtensions({app, bundlePath})

    const signedURL = await getExtensionUploadURL(developerPlatformClient, apiKey)

    const form = formData()
    const buffer = readFileSync(bundlePath)
    form.append('my_upload', buffer)
    await fetch(signedURL, {
      method: 'put',
      body: buffer,
      headers: form.getHeaders(),
    })

    const result = await developerPlatformClient.devSessionDeploy({organizationId: '', appId: apiKey, url: signedURL})

    if (result.devSession.userErrors) {
      stderr.write('Dev Session Error')
      stderr.write(JSON.stringify(result.devSession.userErrors, null, 2))
    }
  })
}
