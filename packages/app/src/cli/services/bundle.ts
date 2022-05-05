import {App} from '../models/app/app'
import {UIExtensionBundle, Bundle} from '../models/app/bundle'
import {file, path} from '@shopify/cli-kit'

async function buildHome(home: any, into: string) {
  // For testing purposes: copy home directory into the specified tmp directory
  await file.copy(home.directory, into)
}
async function buildExtension(extension: any, into: string) {
  // For testing purposes: copy extension directory into the specified tmp directory
  await file.copy(`${extension.directory}/build/index.js`, into)
}

export async function bundle(app: App): Promise<Bundle> {
  const tmpDir = path.resolve(await file.mkTmpDir())

  // const homeFolder = path.join(tmpDir, 'home')
  // await buildHome(app.home, homeFolder)
  // const homeBundle: HomeBundle = {
  //   directory: homeFolder,
  //   metadata: {
  //     type: 'app-home',
  //   },
  // }

  const uiExtensionBundles: UIExtensionBundle[] = []
  await Promise.all(
    app.extensions.ui.map(async (extension) => {
      // replace config name with id when available
      const extensionFolder = path.join(tmpDir, 'todo')
      uiExtensionBundles.push({
        directory: extensionFolder,
        metadata: {
          type: 'ui-extension',
        },
      })
      return buildExtension(extension, `${extensionFolder}/script.js`)
    }),
  )

  return {
    appDirectory: app.directory,
    bundleDirectory: tmpDir,
    // home: homeBundle,
    uiExtensions: uiExtensionBundles,
  }
}
