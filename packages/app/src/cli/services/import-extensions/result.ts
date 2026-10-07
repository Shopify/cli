import {ImportedDashboardExtension} from './types.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'
import {basename, joinPath} from '@shopify/cli-kit/node/path'

export function renderImportExtensionsResult(extensions: ImportedDashboardExtension[]) {
  renderSuccess({
    headline: ['Imported the following extensions from the dashboard:'],
    body: extensions
      .map(({extension, directory}) => {
        return outputContent`• "${extension.title}" at: ${joinPath('extensions', basename(directory))}`.value
      })
      .join('\n'),
  })
}
