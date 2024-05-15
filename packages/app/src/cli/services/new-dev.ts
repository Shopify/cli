import {DevOptions, actionsBeforeLaunchingDevProcesses, launchDevProcesses, setupNetworkingOptions} from './dev.js'
import {DevConfig, setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {startTunnelPlugin} from './dev/urls.js'
import {installAppDependencies} from './dependencies.js'
import {DevContextOptions, ensureDevContext} from './context.js'
import {ports} from '../constants.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export async function newDev(commandOptions: DevOptions) {
  const config = await prepareForDev(commandOptions)
  const {processes, graphiqlUrl, previewUrl} = await setupDevProcesses(config)
  await actionsBeforeLaunchingDevProcesses(config)
  await launchDevProcesses({processes, previewUrl, graphiqlUrl, config})
}

async function prepareForDev(commandOptions: DevOptions): Promise<DevConfig> {
  // Be optimistic about tunnel creation and do it as early as possible
  const tunnelClient = await initTunnelClient(commandOptions)
  const {configuration} = await loadAppConfiguration(commandOptions)
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: DevContextOptions = {...commandOptions, developerPlatformClient}
  const {
    storeFqdn,
    storeId,
    remoteApp,
    remoteAppUpdated,
    // updateURLs: cachedUpdateURLs,
    localApp: app,
  } = await ensureDevContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient
  let localApp = app

  if (!commandOptions.skipDependenciesInstallation && !localApp.usesWorkspaces) {
    localApp = await installAppDependencies(localApp)
  }

  const graphiqlPort = await getGraphiQlPort(commandOptions)

  const {webs, ...network} = await setupNetworkingOptions(
    localApp.webs,
    graphiqlPort,
    {
      noTunnel: commandOptions.noTunnel,
      tunnelUrl: commandOptions.tunnelUrl,
    },
    tunnelClient,
    remoteApp.configuration,
  )
  localApp.webs = webs

  // const partnerUrlsUpdated = await handleUpdatingOfPartnerUrls(
  //   webs,
  //   commandOptions.update,
  //   network,
  //   localApp,
  //   cachedUpdateURLs,
  //   remoteApp,
  //   apiKey,
  //   developerPlatformClient,
  // )

  return {
    storeFqdn,
    storeId,
    remoteApp,
    remoteAppUpdated,
    localApp,
    developerPlatformClient,
    commandOptions,
    network,
    partnerUrlsUpdated: true,
    graphiqlPort,
    graphiqlKey: commandOptions.graphiqlKey,
    beta: true,
  }
}

async function initTunnelClient(commandOptions: DevOptions) {
  const tunnelPort = await getAvailableTCPPort()
  if (!commandOptions.tunnelUrl && !commandOptions.noTunnel) {
    return startTunnelPlugin(commandOptions.commandConfig, tunnelPort, 'cloudflare')
  }
}

async function getGraphiQlPort(commandOptions: DevOptions) {
  const graphiqlPort = commandOptions.graphiqlPort || (await getAvailableTCPPort(ports.graphiql))

  if (graphiqlPort !== (commandOptions.graphiqlPort || ports.graphiql)) {
    renderWarning({
      headline: [
        'A random port will be used for GraphiQL because',
        {command: `${ports.graphiql}`},
        'is not available.',
      ],
      body: [
        'If you want to keep your session in GraphiQL, you can choose a different one by setting the',
        {command: '--graphiql-port'},
        'flag.',
      ],
    })
  }
  return graphiqlPort
}
