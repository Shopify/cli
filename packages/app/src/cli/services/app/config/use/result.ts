import {appConfigUseJsonOutputSchema, type AppConfigUseResult} from './types.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand, outputResult} from '@shopify/cli-kit/node/output'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {basename} from '@shopify/cli-kit/node/path'

export async function renderAppConfigUseResult(
  result: AppConfigUseResult,
  directory: string,
  format: 'json' | 'text',
): Promise<void> {
  if (format === 'json') {
    outputResult(appConfigUseJsonOutputSchema.encode(result))
    return
  }
  if (result.configFile === null) {
    const packageManager = await getPackageManager(directory)
    renderSuccess({
      headline: 'Cleared current configuration.',
      body: [
        'In order to set a new current configuration, please run',
        {command: formatPackageManagerCommand(packageManager, 'shopify app config use CONFIG_NAME')},
        {char: '.'},
      ],
    })
  } else {
    renderSuccess({headline: `Using configuration file ${basename(result.configFile)}`})
  }
}
