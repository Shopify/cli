import {appConfigLinkJsonOutputSchema, type AppConfigLinkResult} from './types.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand, outputResult} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export function renderAppConfigLinkResult(
  result: AppConfigLinkResult,
  packageManager: PackageManager,
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    outputResult(appConfigLinkJsonOutputSchema.encode(result))
    return
  }
  renderSuccessMessage(basename(result.configFile), String(result.configuration.name), packageManager)
}

function renderSuccessMessage(configFileName: string, appName: string, packageManager: PackageManager) {
  renderSuccess({
    headline: `${configFileName} is now linked to "${appName}" on Shopify`,
    body: `Using ${configFileName} as your default config.`,
    nextSteps: [
      [`Make updates to ${configFileName} in your local project`],
      [
        'To upload your config, run',
        {
          command: formatPackageManagerCommand(packageManager, 'shopify app deploy'),
        },
      ],
    ],
    reference: [
      {
        link: {
          label: 'App configuration',
          url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
        },
      },
    ],
  })
}
