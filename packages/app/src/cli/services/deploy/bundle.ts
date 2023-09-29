import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {zip} from '@shopify/cli-kit/node/archiver'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdirSync, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

export interface BundleOptions {
  app: AppInterface
  bundlePath?: string
  identifiers: Identifiers
}

export async function bundleAndBuildExtensions(options: BundleOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    const bundleDirectory = joinPath(tmpDir, 'bundle')
    await mkdirSync(bundleDirectory)
    await touchFile(joinPath(bundleDirectory, '.shopify'))

    const javyRequired = options.app.allExtensions.some((ext) => ext.features.includes('function'))
    if (javyRequired) {
      // Force the download of the javy binary in advance to avoid later problems,
      // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
      await exec('npm', ['exec', '--', 'javy', '--version'], {cwd: options.app.directory})
    }

    await renderConcurrent({
      processes: options.app.allExtensions.map((extension) => {
        return {
          prefix: extension.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await extension.buildForBundle(
              {stderr, stdout, signal, app: options.app},
              options.identifiers,
              bundleDirectory,
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
