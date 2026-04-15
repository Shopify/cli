import {AppInterface, AppManifest} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {installJavy} from '../function/build.js'
import buildWeb from '../web.js'
import {compressBundle, writeManifestToBundle} from '../bundle.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {mkdir, rmdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

interface BundleOptions {
  app: AppInterface
  appManifest: AppManifest
  bundlePath?: string
  identifiers?: Identifiers
  skipBuild: boolean
  isDevDashboardApp: boolean
}

export async function bundleAndBuildExtensions(options: BundleOptions) {
  const bundleDirectory = joinPath(options.app.directory, '.shopify', 'deploy-bundle')
  await rmdir(bundleDirectory, {force: true})
  await mkdir(bundleDirectory)

  await writeManifestToBundle(options.appManifest, bundleDirectory)

  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  if (!options.skipBuild) {
    await installJavy(options.app)
  }

  const webBuildProcesses = options.skipBuild
    ? []
    : options.app.webs
        .filter((web) => web.configuration.commands.build)
        .map((web) => ({
          prefix: ['web', ...web.configuration.roles].join('-'),
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            if (options.skipBuild) return
            await buildWeb('build', {web, stdout, stderr, signal})
          },
        }))

  const extensionBuildProcesses = options.app.allExtensions.map((extension) => ({
    prefix: extension.localIdentifier,
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
      // This outputId is the UID for AppManagement, and UUID for Partners
      // Comes from the matching logic in `ensureDeployContext`
      const outputId = options.isDevDashboardApp
        ? undefined
        : options.identifiers?.extensions[extension.localIdentifier]

      if (options.skipBuild) {
        await extension.copyIntoBundle(
          {stderr, stdout, signal, app: options.app, environment: 'production'},
          bundleDirectory,
          outputId,
        )
      } else {
        await extension.buildForBundle(
          {stderr, stdout, signal, app: options.app, environment: 'production'},
          bundleDirectory,
          outputId,
        )
      }
    },
  }))

  // Web builds must complete before extension builds start. Extensions like
  // the admin module copy output from web builds (e.g. dist/) into the bundle
  // via include_assets. Running them in parallel causes a race condition where
  // dist/ is empty or missing when the admin extension tries to copy it.
  if (webBuildProcesses.length > 0) {
    await renderConcurrent({processes: webBuildProcesses, showTimestamps: false})
  }

  await renderConcurrent({
    processes: extensionBuildProcesses,
    showTimestamps: false,
  })

  if (options.bundlePath) {
    await compressBundle(bundleDirectory, options.bundlePath)
  }
}
