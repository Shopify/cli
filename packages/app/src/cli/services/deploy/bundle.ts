import {buildThemeExtensions, buildFunctionExtension, buildUIExtensions} from '../build/extension'
import {App, Identifiers} from '../../models/app/app'
import {path, output, archiver, temporary, file, error} from '@shopify/cli-kit'

import {Writable} from 'node:stream'

interface BundleOptions {
  app: App
  bundlePath: string
  identifiers: Identifiers
}

export async function bundleUIAndBuildFunctionExtensions(options: BundleOptions) {
  await temporary.directory(async (tmpDir) => {
    const bundleDirectory = path.join(tmpDir, 'bundle')
    await file.mkdir(bundleDirectory)

    await output.concurrent([
      {
        prefix: 'theme_extensions',
        action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
          await buildThemeExtensions({
            app: options.app,
            extensions: options.app.extensions.theme,
            stdout,
            stderr,
            signal,
          })
        },
      },
      {
        prefix: 'ui_extensions',
        action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
          /**
           * For deployment we want the build process to ouptut the artifacts directly in the directory
           * to prevent artifacts from past builds from leaking into deploy builds.
           */
          const extensions = options.app.extensions.ui.map((extension) => {
            const extensionId = options.identifiers.extensions[extension.localIdentifier]
            const buildDirectory = path.join(bundleDirectory, extensionId)
            return {...extension, buildDirectory}
          })
          await buildUIExtensions({
            app: options.app,
            extensions,
            stdout,
            stderr,
            signal,
          })
        },
      },
      ...options.app.extensions.function.map((functionExtension) => {
        return {
          prefix: `function_${functionExtension.localIdentifier}`,
          action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
            await buildFunctionExtension(functionExtension, {stdout, stderr, signal, app: options.app})
          },
        }
      }),
    ])

    output.newline()
    output.success(`${options.app.name} built`)

    await archiver.zip(bundleDirectory, options.bundlePath)
  })
}
