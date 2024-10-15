import {storeFromFqdn, formInfoBoxBody, resetHelpMessage} from './context.js'
import {renderLogs} from './app-logs/logs-command/ui.js'
import {subscribeToAppLogs, sourcesForApp} from './app-logs/utils.js'
import {renderJsonLogs} from './app-logs/logs-command/render-json-logs.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {getAppConfigurationFileName} from '../models/app/loader.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {OrganizationApp} from '../models/organization.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {consoleLog} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export type Format = 'json' | 'text'

interface LogsOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  storeFqdns?: string[]
  sources?: string[]
  status?: string
  format: Format
}

export async function logs(commandOptions: LogsOptions) {
  const {app, remoteApp, developerPlatformClient} = commandOptions
  const logsConfig = await prepareForLogs(commandOptions)

  const validSources = sourcesForApp(app)

  if (validSources.length === 0) {
    throw new AbortError(
      `This app has no log sources. Learn more about app logs at https://shopify.dev/docs/api/shopify-cli/app/app-logs`,
    )
  }

  if (commandOptions.sources) {
    const invalidSources = commandOptions.sources.filter((source) => !validSources.includes(source))
    if (invalidSources.length) {
      throw new AbortError(
        `Invalid sources: ${invalidSources.join(', ')}. Valid sources are: ${validSources.join(', ')}`,
      )
    }
  }

  const variables = {
    shopIds: logsConfig.storeIds,
    apiKey: remoteApp.apiKey,
    token: '',
  }

  const jwtToken = await subscribeToAppLogs(developerPlatformClient, variables)

  const filters = {
    status: commandOptions.status,
    sources: commandOptions.sources,
  }

  const pollOptions = {
    jwtToken,
    filters,
  }

  if (commandOptions.format === 'json') {
    consoleLog(JSON.stringify({subscribedToStores: commandOptions.storeFqdns}))
    consoleLog(JSON.stringify({message: 'Waiting for app logs...'}))
    await renderJsonLogs({
      options: {
        variables,
        developerPlatformClient,
      },
      pollOptions,
      storeNameById: logsConfig.storeNameById,
    })
  } else {
    consoleLog('Waiting for app logs...\n')
    await renderLogs({
      options: {
        variables,
        developerPlatformClient,
      },
      pollOptions,
      storeNameById: logsConfig.storeNameById,
    })
  }
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<{
  storeIds: string[]
  storeNameById: Map<string, string>
}> {
  const {remoteApp, developerPlatformClient} = commandOptions
  const primaryStoreFqdn = commandOptions.storeFqdns?.[0]
  // const devContextOptions: DevContextOptions = {
  //   ...commandOptions,
  //   storeFqdn: primaryStoreFqdn,
  //   developerPlatformClient,
  //   customInfoBox: true,
  // }
  // const {storeId, storeFqdn, remoteApp, localApp, organization, configFile} = await ensureDevContext(devContextOptions)
  if (commandOptions.format === 'text') {
    renderAppLogsConfigInfo(remoteApp.title, storeFqdn, commandOptions.storeFqdns, configFile, organization)
  }
  const storeNameById = new Map<string, string>()
  storeNameById.set(storeId, storeFqdn)
  if (commandOptions.storeFqdns && commandOptions.storeFqdns.length > 1) {
    await Promise.all(
      commandOptions.storeFqdns?.slice(1).map((storeFqdn) => {
        return storeFromFqdn(storeFqdn, remoteApp.organizationId, developerPlatformClient).then((store) => {
          storeNameById.set(store.shopId, storeFqdn)
        })
      }),
    )
  }
  const storeIds = Array.from(storeNameById.keys())

  return {storeIds, storeNameById}
}

function renderAppLogsConfigInfo(
  appName: string,
  storeFqdn: string,
  storeFqdns?: string[],
  configFile?: string,
  org?: string,
) {
  const devStores = []
  if (storeFqdns && storeFqdns.length > 0) {
    storeFqdns.forEach((storeUrl) => devStores.push(storeUrl))
  } else {
    devStores.push(storeFqdn)
  }
  const body = formInfoBoxBody(appName, org, devStores, resetHelpMessage)
  const fileName = configFile && getAppConfigurationFileName(configFile)

  renderInfo({
    headline: `${configFile ? `Using ${fileName} for default values:` : 'Using these settings:'}`,
    body,
  })
}
