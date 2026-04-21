import {AppInterface, AppManifest} from '../../models/app/app.js'
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
  appManifest: AppManifest
  bundlePath: string
  identifiers?: Identifiers
  skipBuild: boolean
  isDevDashboardApp: boolean
}

/**
 * Builds all extensions into a bundle directory and compresses it when at
 * least one extension declares deploy steps. Returns the bundlePath in that
 * case, or undefined when no extension has deploy steps and there's nothing
 * to upload beyond the manifest.
 */
export async function bundleAndBuildExtensions(options: BundleOptions): Promise<string | undefined> {
  const bundleDirectory = joinPath(options.app.directory, '.shopify', 'deploy-bundle')
  await rmdir(bundleDirectory, {force: true})
  await mkdir(bundleDirectory)

  await writeManifestToBundle(options.appManifest, bundleDirectory)

  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  if (!options.skipBuild) {
    await installJavy(options.app)
  }

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

  await renderConcurrent({
    processes: extensionBuildProcesses,
    showTimestamps: false,
  })

  const hasExtensionOutput = options.app.allExtensions.some((ext) => ext.hasDeploySteps)

  if (hasExtensionOutput) {
    await compressBundle(bundleDirectory, options.bundlePath)
    return options.bundlePath
  }

  return undefined
}
