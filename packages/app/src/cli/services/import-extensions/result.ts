import {ImportExtensionsResult} from './types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'
import {basename, joinPath} from '@shopify/cli-kit/node/path'

export function renderImportExtensionsResult(result: ImportExtensionsResult) {
  if (result.reason === 'no-extensions') throw new AbortError('No extensions to migrate')

  renderSuccess({
    headline: ['Imported the following extensions from the dashboard:'],
    body: result.extensions
      .map(({extension, directory}) => {
        return outputContent`• "${extension.title}" at: ${joinPath('extensions', basename(directory))}`.value
      })
      .join('\n'),
  })
}
