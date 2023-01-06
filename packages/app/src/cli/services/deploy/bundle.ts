import {buildFunctionExtension, buildUIExtensions} from '../build/extension.js'
import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {bundleThemeExtensions} from '../extensions/bundle.js'
import {path, file} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

interface BundleOptions {
  app: AppInterface
  bundlePath: string
  identifiers: Identifiers
  bundle: boolean
}

export async function bundleUIAndBuildFunctionExtensions(options: BundleOptions) {
  await file.inTemporaryDirectory(async (tmpDir) => {
    const bundleDirectory = path.join(tmpDir, 'bundle')
    await file.mkdir(bundleDirectory)
    await file.touch(path.join(bundleDirectory, '.shopify'))

    await renderConcurrent({
      processes: [
        {
          prefix: 'theme_extensions',
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await bundleThemeExtensions({
              app: options.app,
              extensions: options.app.extensions.theme.map((themeExtension) => {
                const extensionId = options.identifiers.extensions[themeExtension.localIdentifier]!
                themeExtension.outputBundlePath = path.join(bundleDirectory, extensionId)
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
                uiExtension.outputBundlePath = path.join(
                  bundleDirectory,
                  extensionId,
                  path.basename(uiExtension.outputBundlePath),
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

    if (options.bundle) {
      await zip(bundleDirectory, options.bundlePath)
    }
  })
}
