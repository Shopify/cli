import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'
import {Writable} from 'stream'

export interface AppLogsQueryOptions {
  shopIds: [string]
  apiKey: string
  token: string
}

export interface AppLogsSubscribeProcess extends BaseProcess<AppLogsQueryOptions> {
  type: 'app-logs-subscribe'
}

interface Props {
  partnersSessionToken: string
  subscription: {
    shopIds: [string]
    apiKey: string
  }
}

const AppLogsSubscribeMutation = gql`
  mutation AppLogsSubscribe($input: AppLogsSubscribeInput!) {
    appLogsSubscribe(input: $input) {
      jwtToken
      success
      errors
    }
  }
`

export function setupAppLogsSubscribeProcess({
  partnersSessionToken,
  subscription: {shopIds, apiKey},
}: Props): AppLogsSubscribeProcess | undefined {
  return {
    type: 'app-logs-subscribe',
    prefix: 'app-events',
    function: subscribeToAppLogs,
    options: {
      shopIds, // For both requests
      apiKey, // For subscribe request
      token: partnersSessionToken, // For subscribe request
    },
  }
}

interface AppLog {
  logs?: string
  error_message?: string
  error_type?: string
  fuel_consumed?: number
  input?: string
  output?: string
  input_bytes?: number
  output_nytes?: number
  invocation_id?: string
  function_id?: string
}

export const subscribeToAppLogs: DevProcessFunction<AppLogsQueryOptions> = async ({stdout}, options) => {
  const result = await partnersRequest<{
    appLogsSubscribe: {
      jwtToken: string
      success: boolean
      errors: string[]
    }
  }>(AppLogsSubscribeMutation, options.token, {
    input: {shopIds: options.shopIds, apiKey: options.apiKey},
  })
  const {success, errors, jwtToken} = result.appLogsSubscribe

  stdout.write(`API Key: ${options.apiKey}\n`)

  if (errors.length > 0) {
    errors.forEach((error) => {
      stdout.write(`Error: ${error}\n`)
    })
  } else {
    stdout.write(`Subscribed to App Events for SHOP ID(s) ${options.shopIds}\n`)
    stdout.write(`Success: ${success}\n`)
    stdout.write(`Token: ${jwtToken}\n`)
    stdout.write(`API Key: ${options.apiKey}\n`)
  }
  await fetchAppLogs({stdout, appLogsFetchInput: {jwtToken, oldestMessageRead: new Date().toISOString()}})
}

const generateFetchAppLogUrl = (oldestMessageRead: string) => {
  const url = 'https://partners.script-service-0s4r.mehdi-salemi.us.spin.dev/app_logs/poll'
  return `${url}?oldest_message_read=${oldestMessageRead}`
}

export const fetchAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, oldestMessageRead},
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; oldestMessageRead: string}
}) => {
  const functionErrorOutput = ({
    event,
  }: {
    event: {
      type: string
      shop_id: number
      app_id: number
      event_timestamp: string
      payload: AppLog
    }
  }) => {
    const part1 = `❌ ${event.type === 'function-run' ? 'Function' : 'other?'} my-product-discount failed to execute: ${
      event.payload.error_type
    }`
    const part2 = event.payload.logs || 'no logs found'
    const part25 = event.payload.error_message
    const part3 = 'Log: /~/my-product-discount'
    stdout.write(part1)
    stdout.write(part2)
    stdout.write(part25)
    stdout.write(part3)
  }
  const functionSuccessOutput = ({
    event,
  }: {
    event: {
      type: string
      shop_id: number
      app_id: number
      event_timestamp: string
      payload: AppLog
    }
  }) => {
    const part1 = `✅ ${event.type === 'function-run' ? 'Function' : 'other?'} executed in ${
      event.payload?.fuel_consumed
    } instructions:`
    const part2 = event.payload.logs
    const part3 = 'some more custom logging about discounting'
    const part4 = 'Log: /~/my-product-discount'
    stdout.write(part1)
    stdout.write(part2)
    stdout.write(part3)
    stdout.write(part4)
  }
  const functionOutput = ({
    log,
  }: {
    log: {
      type: string
      shop_id: number
      app_id: number
      event_timestamp: string
      payload: AppLog
    }
  }) => {
    if (log.payload.error_type) {
      functionErrorOutput({event: log})
    } else {
      functionSuccessOutput({event: log})
    }
  }

  stdout.write(`JWT Token Poll: ${jwtToken}\n`)
  stdout.write(`Oldest Message Read: ${oldestMessageRead}\n`)

  const url = generateFetchAppLogUrl(oldestMessageRead)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = (await response.json()) as {
    app_logs: {
      type: string
      shop_id: number
      app_id: number
      event_timestamp: string
      payload: AppLog
    }[]
    success: boolean
    errors: string[]
  }

  if (data.errors?.length > 0) {
    data?.errors?.forEach((error) => {
      stdout.write(`${error}\n`)
    })
  } else if (data.app_logs?.length > 0) {
    const {app_logs: appLogs} = data
    appLogs?.forEach((log) => {
      functionOutput({log})
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    await fetchAppLogs({stdout, appLogsFetchInput: {jwtToken, oldestMessageRead}})
  }, 1000)
}
