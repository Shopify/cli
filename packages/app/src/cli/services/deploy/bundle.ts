import {buildExtension} from '../build/extension'
import {App} from '../../models/app/app'
import {path, output, archiver, temporary, file} from '@shopify/cli-kit'

import {Writable} from 'node:stream'

interface BundleOptions {
  // The app to be bundled
  app: App

  // Path to the .zip file that represents the app bundle
  bundlePath: string
}

export async function bundle(options: BundleOptions) {
  await temporary.directory(async (tmpDir) => {
    const bundleDirectory = path.join(tmpDir, 'bundle')
    await file.mkdir(bundleDirectory)

    await output.concurrent([
      {
        prefix: 'extensions',
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          await buildExtension({app: options.app, extensions: options.app.extensions.ui, stdout, stderr, signal})
        },
      },
    ])

    output.newline()
    output.success(`${options.app.name} built`)

    await archiver.zip(bundleDirectory, options.bundlePath)
  })
}
