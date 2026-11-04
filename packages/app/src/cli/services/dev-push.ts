import {LoadedAppContextOutput} from './app-context.js'
import {DevPushResult} from './dev-push/types.js'
import {generateApplicationURLsForApp} from './dev/urls.js'
import {blockIfMigrationIncomplete} from './dev.js'
import {installAppDependencies} from './dependencies.js'
import {compressBundle, writeManifestToBundle} from './bundle.js'
import {devBundlePath, uploadDevBundle} from './dev/dev-bundle.js'
import {OrganizationStore} from '../models/organization.js'
import {buildAppURLForAdmin} from '../utilities/app/app-url.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {adminFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {readDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {renderConcurrent, renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'

interface DevPushOptions {
  appContextResult: LoadedAppContextOutput
  store: OrganizationStore
  url?: string
  skipDependenciesInstallation?: boolean
}

export async function devPush({
  appContextResult,
  store,
  url,
  skipDependenciesInstallation = false,
}: DevPushOptions): Promise<DevPushResult> {
  const controller = new AbortController()
  const {signal} = controller
  let creationStarted = false
  const cancel = (signalName = 'SIGINT') => {
    if (signal.aborted) return
    const message = creationStarted
      ? 'Dev preview push cancelled. The preview may already have been updated.'
      : 'Dev preview push cancelled.'
    const exitCodes: Record<string, number> = {SIGINT: 130, SIGTERM: 143, SIGQUIT: 131}
    const exit = exitCodes[signalName] ?? 130
    controller.abort(Object.assign(new AbortError(message), {code: 'dev_push_cancelled', oclif: {exit}}))
  }
  process.on('shopify:signal', cancel)
  try {
    const {app, project, remoteApp, developerPlatformClient} = appContextResult
    const running = await readDevInstance({command: 'app dev', directory: app.directory, key: basename(app.configPath)})
    signal.throwIfAborted()
    if (running) {
      throw new AbortError(
        'This app configuration already has a running dev session.',
        'Stop shopify app dev and run shopify app dev clean for this store before pushing a snapshot.',
      )
    }

    await blockIfMigrationIncomplete({remoteApp, developerPlatformClient})
    signal.throwIfAborted()

    if (url) app.setDevApplicationURLs(generateApplicationURLsForApp(app, url))

    if (!skipDependenciesInstallation && !project.usesWorkspaces) await installAppDependencies(project, {signal})
    signal.throwIfAborted()

    return await inTemporaryDirectory(async (directory) => {
      const bundleDirectory = joinPath(directory, 'bundle')
      const bundlePath = devBundlePath(directory, developerPlatformClient)
      await mkdir(bundleDirectory)

      let build: Promise<void> | undefined
      let buildCompleted = false
      try {
        await renderConcurrent({
          processes: [
            {
              prefix: 'extensions',
              action: (stdout, stderr) => {
                build = (async () => {
                  for (const extension of app.realExtensions) {
                    signal.throwIfAborted()
                    // eslint-disable-next-line no-await-in-loop
                    await extension.buildForBundle(
                      {
                        app,
                        stdout,
                        stderr,
                        signal,
                        environment: 'development',
                        appURL: app.configuration.application_url,
                      },
                      bundleDirectory,
                    )
                  }
                  signal.throwIfAborted()
                  buildCompleted = true
                })()
                return build
              },
            },
          ],
          abortSignal: signal,
          showTimestamps: false,
        })
        // Ink can close on Ctrl-C before its build action has settled.
        if (!buildCompleted) cancel()
        signal.throwIfAborted()
      } finally {
        // Never remove the temporary bundle directory while a builder still owns it.
        if (build) await Promise.allSettled([build])
      }

      const manifest = await app.manifest(undefined)
      await writeManifestToBundle(manifest, bundleDirectory)
      // A config-only preview still needs its manifest uploaded, even when no extension produced assets.
      await compressBundle(bundleDirectory, bundlePath)
      signal.throwIfAborted()

      const response = await renderSingleTask({
        title: outputContent`Creating dev preview`,
        onAbort: () => cancel(),
        task: async () => {
          const assetsUrl = await uploadDevBundle({
            developerPlatformClient,
            app: {apiKey: remoteApp.id, id: remoteApp.id, organizationId: remoteApp.organizationId},
            bundlePath,
            signal,
          })
          signal.throwIfAborted()
          creationStarted = true
          return developerPlatformClient.devSessionCreate({
            appId: remoteApp.id,
            shopFqdn: store.shopDomain,
            assetsUrl,
            signal,
          })
        },
      })

      signal.throwIfAborted()
      const result = response?.devSessionCreate
      if (
        !result ||
        !Array.isArray(result.userErrors) ||
        result.userErrors.some((error) => typeof error?.message !== 'string')
      ) {
        throw new AbortError('Failed to create the dev preview: the server returned an invalid response.')
      }
      if (result.userErrors.length) {
        const error = new AbortError(
          `Failed to create the dev preview: ${result.userErrors.map((userError) => userError.message).join('\n')}`,
        )
        error.details = {userErrors: result.userErrors}
        throw error
      }
      if (!result.devSession) {
        throw new AbortError('Failed to create the dev preview: the server returned no dev session.')
      }

      const previewUrl = buildAppURLForAdmin(store.shopDomain, remoteApp.apiKey, await adminFqdn(), {devConsole: false})
      signal.throwIfAborted()

      return {
        status: 'success',
        app: {name: remoteApp.title, clientId: remoteApp.apiKey},
        storeDomain: store.shopDomain,
        appUrl: app.configuration.application_url,
        previewUrl,
        warnings: (result.warnings ?? []).map(({code, message}) => ({code, message})),
      }
    })
  } catch (error) {
    if (signal.aborted) throw signal.reason
    throw error
  } finally {
    process.removeListener('shopify:signal', cancel)
  }
}
