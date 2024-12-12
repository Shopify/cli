import {Workflow} from './registry.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'

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
    const tomlPath = joinPath(options.generatedExtension.directory, 'shopify.extension.toml')
    const tomlContents = await readFile(tomlPath)
    const configuration = decodeToml(tomlContents)
    if (configuration.extensions && Array.isArray(configuration.extensions) && configuration.extensions.length > 0) {
      ;(configuration.extensions[0] as {includes: string[]}).includes = extensions
        .split(',')
        .map((handle) => handle.trim())
    }
    const encodedString = encodeToml(configuration)
    await writeFile(tomlPath, encodedString)
  },
}
