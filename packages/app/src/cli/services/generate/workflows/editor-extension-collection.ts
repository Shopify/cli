import {Workflow} from './registry.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {patchConfigurationFile} from './patch-configuration-file.js'

export const editorExtensionCollection: Workflow = {
  afterGenerate: async (options) => {
    const existingExtensions = options.generateOptions.app.extensionsForType({
      identifier: 'ui_extension',
      externalIdentifier: 'ui_extension',
    })
    const availableExtensions = existingExtensions.map((extension) => extension.handle).join(' ')
    const extensions = await renderTextPrompt({
      message: `The extension handles to include in the collection, comma separated. Options: ${availableExtensions}`,
    })
    await patchConfigurationFile({
      path: joinPath(options.generatedExtension.directory, 'shopify.extension.toml'),
      patch: {
        extensions: [{
          includes: extensions.split(',').map((handle) => handle.trim())
        }],
      },
    })
    return {
      success: true,
    }
  },
}
