import {renderLogs} from './dev/ui.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

interface LogOptions {
  directory: string
  reset: false
  storeFqdn: string
  apiKey: string
}

type LogProcessFunction<TOptions = unknown> = (
  context: {stdout: Writable; stderr: Writable; abortSignal: AbortSignal},
  options: TOptions,
) => Promise<void>

interface BaseProcess<T> {
  prefix: string
  function: LogProcessFunction<T>
  options: T
}

type LogProcessDefinition = LogSubscribeProcesses

interface AppEventsSubscribeMutationOptions {
  shopId: string
  apiKey: string
  token: string
}

interface LogSubscribeProcesses extends BaseProcess<AppEventsSubscribeMutationOptions> {
  type: 'app-events-subscribe'
}

export async function logs({directory, reset, storeFqdn, apiKey}: LogOptions) {
  console.log('run->[logs] The Logs Command has Started!')
  console.log('[logs] props: ', {directory, reset, storeFqdn, apiKey})

  const config = setupLogsConfig()
  // now call setupLogsProcess
  const developerPlatformClient = selectDeveloperPlatformClient()
  // need store id and remote app now for some reaosn...
  console.log('developerPlatformClient', developerPlatformClient)
  const processes: OutputProcess[] = []
  const abortController = new AbortController()
  // END GOAL BEING: LAUNCH THIS NEW DEV PROCESS
  // runs the process above with (import {OutputProcess, formatPackageManagerCommand, outputDebug} from '@shopify/cli-kit/node/output')
  // map processes from the config, to OutputProcess[]
  // then render with RenderLogs({outputProcesses})
  // this should render a <Log process={outputProcesses} /> component, which i think it what the CLI sees
  // packages/app/src/cli/services/dev/ui/components/Dev.tsx
  // packages/app/src/cli/services/dev/ui.tsx
  await renderLogs({
    processes,
    abortController,
    pollingTime: 1000,
  })
}

// This should return config, which is everything is needed to run the process in <Log />
function setupLogsConfig() {
  return {}
}

interface LogsConfig {
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {
    apiSecret?: string | undefined
  }
  developerPlatformClient: DeveloperPlatformClient
}

export async function setupLogsProcess({remoteApp, developerPlatformClient}: LogsConfig): Promise<{
  processes: LogProcessDefinition[]
}> {
  const apiKey = remoteApp.apiKey
  const {token: partnersSessionToken} = await developerPlatformClient.session()
  return {
    processes: [
      {
        type: 'app-events-subscribe',
        prefix: 'app-events',
        function: subscribeToAppEvents,
        options: {
          shopId: '2',
          apiKey,
          token: partnersSessionToken,
        },
      },
    ],
  }
}

const AppEventsSubscribeMutation = gql`
  mutation AppEventsSubscribe($input: AppEventsSubscribeInput!) {
    appEventsSubscribe(input: $input) {
      jwtToken
      success
      errors
    }
  }
`

const subscribeToAppEvents: LogProcessFunction<AppEventsSubscribeMutationOptions> = async ({stdout}, options) => {
  const result = await partnersRequest(AppEventsSubscribeMutation, options.token, {
    input: {shopId: options.shopId, apiKey: options.apiKey},
  })
  console.log('[subscribeToAppEvents](AppEventsSubscribeMutation) result: ', result)

  stdout.write(`Subscribed to App Events for SHOP ID ${options.shopId} Api Key ${options.apiKey}\n`)
}
