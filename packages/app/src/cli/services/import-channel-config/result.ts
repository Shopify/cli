import {importChannelConfigJsonOutputSchema, type ImportedChannelConfig} from './types.js'
import {relativePath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export function renderImportChannelConfigResult(
  result: ImportedChannelConfig,
  app: {directory: string; name: string},
  format: 'json' | 'text',
): void {
  result.warnings.forEach((warning) => renderWarning({body: warning.message}))
  if (format === 'json') {
    outputResult(
      importChannelConfigJsonOutputSchema.encode({
        status: result.status,
        handle: result.handle,
        filename: result.filename,
        path: result.path,
        toml: result.toml,
        warnings: result.warnings.map(({code, message}) => ({code, message})),
      }),
    )
    return
  }

  renderSuccess({
    headline: ['Imported the channel spec for', {userInput: app.name}, {char: '.'}],
    body: [
      'The spec was written to',
      {filePath: relativePath(app.directory, result.path)},
      {char: '.'},
      ...(result.extensionConfigurationPath
        ? [
            'Also created',
            {filePath: relativePath(app.directory, result.extensionConfigurationPath)},
            'so the spec is included when your app is deployed.',
          ]
        : []),
    ],
    nextSteps: [
      'Review the generated spec and make any changes your channel needs.',
      ['Run', {command: 'shopify app dev'}, 'to try the spec on a development store before releasing it.'],
      ['Run', {command: 'shopify app deploy'}, 'to deploy the spec as part of your app.'],
    ],
  })
}
