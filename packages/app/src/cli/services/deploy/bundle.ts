import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {installJavy} from '../function/build.js'
import {zip} from '@shopify/cli-kit/node/archiver'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdirSync, touchFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

interface BundleOptions {
  app: AppInterface
  bundlePath?: string
  identifiers?: Identifiers
}

export async function bundleAndBuildExtensions(options: BundleOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    const bundleDirectory = joinPath(tmpDir, 'bundle')
    mkdirSync(bundleDirectory)
    await touchFile(joinPath(bundleDirectory, '.shopify'))

    // Include manifest in bundle
    const appManifest = await options.app.manifest()
    const manifestPath = joinPath(bundleDirectory, 'manifest.json')
    writeFileSync(manifestPath, JSON.stringify(appManifest, null, 2))

    // Force the download of the javy binary in advance to avoid later problems,
    // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
    await installJavy(options.app)

    await renderConcurrent({
      processes: options.app.allExtensions.map((extension) => {
        return {
          prefix: extension.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await extension.buildForBundle(
              {stderr, stdout, signal, app: options.app, environment: 'production'},
              bundleDirectory,
              options.identifiers,
            )
          },
        }
      }),
      showTimestamps: false,
    })

    if (options.bundlePath) {
      await zip({
        inputDirectory: bundleDirectory,
        outputZipPath: options.bundlePath,
      })
    }
  })
}
