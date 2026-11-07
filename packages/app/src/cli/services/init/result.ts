import {appInitJsonOutputSchema, type AppInitResult, type InitResult} from './types.js'
import {numericIdFromGid} from '@shopify/cli-kit/common/gid'
import {formatPackageManagerCommand, outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function initResultToJson({app, remoteApp, packageManager, template}: InitResult): AppInitResult {
  return appInitJsonOutputSchema.validate({
    status: 'success',
    app: {
      id: remoteApp.id.startsWith('gid://shopify/App/')
        ? (numericIdFromGid(remoteApp.id) ?? remoteApp.id)
        : remoteApp.id,
      name: remoteApp.title,
      clientId: remoteApp.apiKey,
      organizationId: remoteApp.organizationId,
      directory: app.directory,
      configurationPath: app.configPath,
    },
    packageManager,
    template,
  })
}

export function renderInitResult(result: InitResult, json = false): void {
  if (json) {
    outputResult(appInitJsonOutputSchema.encode(initResultToJson(result)))
    return
  }

  const {projectName, packageManager} = result
  renderSuccess({
    headline: [{userInput: projectName}, 'is ready for you to build!'],
    nextSteps: [
      ['Run', {command: `cd ${projectName}`}],
      ['For extensions, run', {command: formatPackageManagerCommand(packageManager, 'shopify app generate extension')}],
      ['To see your app, run', {command: formatPackageManagerCommand(packageManager, 'shopify app dev')}],
    ],
    reference: [
      {link: {label: 'Shopify docs', url: 'https://shopify.dev'}},
      [
        {
          link: {
            label: 'Shopify Dev MCP,',
            url: 'https://shopify.dev/docs/apps/build/devmcp',
          },
        },
        'connect your AI assistant to development resources',
      ],
      [
        'For an overview of commands, run',
        {command: formatPackageManagerCommand(packageManager, 'shopify app', '--help')},
      ],
    ],
  })
}
