import {buildExtension} from '../build/extension'
import {App, Identifiers} from '../../models/app/app'
import {path, output, archiver, temporary, file, error} from '@shopify/cli-kit'

import {Writable} from 'node:stream'

interface BundleOptions {
  app: App
  bundlePath: string
  identifiers: Identifiers
}

export async function bundle(options: BundleOptions) {
  await temporary.directory(async (tmpDir) => {
    const bundleDirectory = path.join(tmpDir, 'bundle')
    await file.mkdir(bundleDirectory)

    await output.concurrent([
      {
        prefix: 'extensions',
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
          await buildExtension({app: options.app, extensions, stdout, stderr, signal})
        },
      },
    ])

    output.newline()
    output.success(`${options.app.name} built`)

    await archiver.zip(bundleDirectory, options.bundlePath)
  })
}
