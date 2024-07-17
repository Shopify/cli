import {DevContextOptions, ensureDevContext} from './context.js'
import {renderLogs} from './app-logs/logs-command/ui.js'
import {subscribeToAppLogs} from './app-logs/utils.js'
import {selectDeveloperPlatformClient, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {AppInterface} from '../models/app/app.js'
import {pollAppLogs} from './app-logs/logs-command/poll-app-logs.js'
import {PollOptions, SubscribeOptions} from './app-logs/types.js'
import {
  POLLING_ERROR_RETRY_INTERVAL_MS,
  ONE_MILLION,
  POLLING_INTERVAL_MS,
  POLLING_THROTTLE_RETRY_INTERVAL_MS,
  parseFunctionRunPayload,
  LOG_TYPE_FUNCTION_RUN,
  LOG_TYPE_RESPONSE_FROM_CACHE,
  parseNetworkAccessResponseFromCachePayload,
  LOG_TYPE_REQUEST_EXECUTION_IN_BACKGROUND,
  parseNetworkAccessRequestExecutionInBackgroundPayload,
  LOG_TYPE_REQUEST_EXECUTION,
  parseNetworkAccessRequestExecutedPayload,
} from './app-logs/utils.js'
import {ErrorResponse, SuccessResponse, AppLogOutput, PollFilters, AppLogPayload} from './app-logs/types.js'
import {outputInfo} from '@shopify/cli-kit/node/output'

interface LogsOptions {
  directory: string
  reset: boolean
  apiKey?: string
  storeFqdn?: string
  source?: string
  status?: string
  configName?: string
  userProvidedConfigName?: string
}

export async function logs(commandOptions: LogsOptions) {
  const logsConfig = await prepareForLogs(commandOptions)

  const variables = {
    shopIds: [logsConfig.storeId],
    apiKey: logsConfig.apiKey,
    token: '',
  }

  const jwtToken = await subscribeToAppLogs(logsConfig.developerPlatformClient, variables)

  const filters = {
    status: commandOptions.status,
    source: commandOptions.source,
  }

  const pollOptions = {
    jwtToken,
    filters,
  }

  await renderJsonLogs({
    options: {
      variables,
      developerPlatformClient: logsConfig.developerPlatformClient,
    },
    pollOptions,
  })

  // await renderLogs({
  //   options: {
  //     variables,
  //     developerPlatformClient: logsConfig.developerPlatformClient,
  //   },
  //   pollOptions,
  // })
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<{
  storeId: string
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  localApp: AppInterface
}> {
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: DevContextOptions = {...commandOptions, developerPlatformClient}
  const {storeId, remoteApp, localApp} = await ensureDevContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const apiKey = remoteApp.apiKey

  return {
    storeId,
    developerPlatformClient,
    apiKey,
    localApp,
  }
}

async function renderJsonLogs({
  pollOptions: {cursor, filters, jwtToken},
  options: {variables, developerPlatformClient},
}: {
  pollOptions: PollOptions
  options: SubscribeOptions
}): Promise<void> {
  const response = await pollAppLogs({cursor, filters, jwtToken})
  let nextInterval = POLLING_INTERVAL_MS
  let nextJwtToken = jwtToken

  const {errors} = response as ErrorResponse

  if (errors && errors.length > 0) {
    if (errors.some((error) => error.status === 401)) {
      const nextJwtToken = await subscribeToAppLogs(developerPlatformClient, variables)
    } else if (errors.some((error) => error.status === 429)) {
      nextInterval = POLLING_THROTTLE_RETRY_INTERVAL_MS
    } else {
      nextInterval = POLLING_ERROR_RETRY_INTERVAL_MS

      outputInfo(
        JSON.stringify({
          errors: errors,
          retrying_in_ms: nextInterval,
        }),
      )
    }
  }

  const {cursor: nextCursor, appLogs} = response as SuccessResponse

  if (appLogs) {
    appLogs.forEach((log) => {
      outputInfo(JSON.stringify(log))
    })
  }

  setTimeout(() => {
    renderJsonLogs({
      options: {variables: variables, developerPlatformClient: developerPlatformClient},
      pollOptions: {
        jwtToken: nextJwtToken || jwtToken,
        cursor: nextCursor || cursor,
        filters,
      },
    }).catch((error) => {
      throw error
    })
  }, nextInterval)
}
