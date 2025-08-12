import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {installJavy} from '../function/build.js'
import {compressBundle, writeManifestToBundle} from '../bundle.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {mkdir, rmdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

interface BundleOptions {
  app: AppInterface
  bundlePath?: string
  identifiers?: Identifiers
  skipBuild: boolean
  isDevDashboardApp: boolean
}

export async function bundleAndBuildExtensions(options: BundleOptions) {
  const bundleDirectory = joinPath(options.app.directory, '.shopify', 'deploy-bundle')
  await rmdir(bundleDirectory, {force: true})
  await mkdir(bundleDirectory)

  await writeManifestToBundle(options.app, bundleDirectory, options.identifiers)

  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  if (!options.skipBuild) {
    await installJavy(options.app)
  }

  await renderConcurrent({
    processes: options.app.allExtensions.map((extension) => {
      return {
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
      }
    }),
    showTimestamps: false,
  })

  if (options.bundlePath) {
    await compressBundle(bundleDirectory, options.bundlePath)
  }
}
