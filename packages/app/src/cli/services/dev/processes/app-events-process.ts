import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppLogsQueryOptions {
  shopIds: [number]
  apiKey: string
  token: string
}

export interface AppLogsSubscribeProcess extends BaseProcess<AppLogsQueryOptions> {
  type: 'app-events-subscribe'
}

interface Props {
  partnersSessionToken: string
  subscription: {
    shopId: string
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
  subscription: {shopId, apiKey},
}: Props): AppLogsSubscribeProcess | undefined {
  return {
    type: 'app-events-subscribe',
    prefix: 'app-events',
    function: subscribeToAppLogs,
    options: {
      shopIds: [parseInt(shopId, 10)],
      apiKey,
      token: partnersSessionToken,
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
  const result = await partnersRequest(AppLogsSubscribeMutation, options.token, {
    input: {shopIds: options.shopIds, apiKey: options.apiKey},
  })
  console.log('[subscribeToAppLogs](AppLogsSubscribeMutation) result 123: ', result)

  stdout.write(`Subscribed to App Events for SHOP ID ${options.shopIds} Api Key ${options.apiKey}\n`)

  let pollOldestMessageReadTime = new Date().toISOString()

  async function fetchAppLogsInner() {
    const token =
      'eyJhbGciOiJIUzI1NiJ9.eyJzaG9wX2lkcyI6WzJdLCJhcHBfaWQiOjkwNTc0MzM5ODU3NiwiZXhwaXJlc19hdCI6MTcxNDgyOTcxM30.u1c99rvB3q6bbwSExdbEPkiZxZEreoy2U8wNtgWR3RY'

    const generateUrl = (oldestMessageRead: string) => {
      const url = 'https://partners.script-service-juf8.mehdi-salemi.us.spin.dev/app_logs'
      return `${url}?oldest_message_read=${oldestMessageRead}`
    }

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
      const part1 = `❌ ${
        event.type === 'function-run' ? 'Function' : 'other?'
      } my-product-discount failed to execute: ${event.payload.error_type}`
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

    const response = await fetch(generateUrl(pollOldestMessageReadTime), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    console.log('response: ', response)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = (await response.json()) as {
      app_logs?: {
        type: string
        shop_id: number
        app_id: number
        event_timestamp: string
        payload: AppLog
      }[]
      success?: boolean
      errors?: string[]
    }

    if (data.app_logs?.length === 0) {
      // console.log(data)
    } else {
      const {app_logs: appLogs} = data
      appLogs?.forEach((log) => {
        functionOutput({log})
      })
      pollOldestMessageReadTime = new Date().toISOString()
    }
  }

  const startPolling = () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return setInterval(() => fetchAppLogsInner(), 2000)
  }
  await startPolling()
}
