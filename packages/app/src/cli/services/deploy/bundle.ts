import {buildFunctionExtension, buildUIExtensions} from '../build/extension.js'
import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {bundleThemeExtensions} from '../extensions/bundle.js'
import {zip} from '@shopify/cli-kit/node/archiver'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdirSync, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

interface BundleOptions {
  app: AppInterface
  bundlePath?: string
  identifiers: Identifiers
}

export async function bundleAndBuildExtensions(options: BundleOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    const bundleDirectory = joinPath(tmpDir, 'bundle')
    await mkdirSync(bundleDirectory)
    await touchFile(joinPath(bundleDirectory, '.shopify'))

    await renderConcurrent({
      processes: [
        {
          prefix: 'theme_extensions',
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await bundleThemeExtensions({
              app: options.app,
              extensions: options.app.extensions.theme.map((themeExtension) => {
                const extensionId = options.identifiers.extensions[themeExtension.localIdentifier]!
                themeExtension.outputBundlePath = joinPath(bundleDirectory, extensionId)
                return themeExtension
              }),
              stdout,
              stderr,
              signal,
            })
          },
        },
        ...(await buildUIExtensions({
          app: {
            ...options.app,
            extensions: {
              ...options.app.extensions,
              ui: options.app.extensions.ui.map((uiExtension) => {
                const extensionId = options.identifiers.extensions[uiExtension.localIdentifier]!
                uiExtension.outputBundlePath = joinPath(
                  bundleDirectory,
                  extensionId,
                  basename(uiExtension.outputBundlePath),
                )
                return uiExtension
              }),
            },
          },
        })),
        ...options.app.extensions.function.map((functionExtension) => {
          return {
            prefix: functionExtension.localIdentifier,
            action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
              await buildFunctionExtension(functionExtension, {stdout, stderr, signal, app: options.app})
            },
          }
        }),
      ],
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
