import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppEventsQueryOptions {
  shopIds: [string]
  apiKey: string
  token: string
  jwtToken?: string
}

export interface AppEventsSubscribeProcess extends BaseProcess<AppEventsQueryOptions> {
  type: 'app-events-subscribe'
}

interface Props {
  partnersSessionToken: string
  subscription: {
    shopIds: [string]
    apiKey: string
  }
  prefix: string
}

const AppEventsSubscribeMutation = gql`
  mutation AppEventsSubscribe($input: AppLogsSubscribeInput!) {
    appLogsSubscribe(input: $input) {
      jwtToken
      success
      errors
    }
  }
`

const FetchAppLogsQuery = gql`
  query FetchLogsEvents($jwtToken: String!, $oldestMessageRead: String!) {
    appLogs(jwtToken: $jwtToken, oldestMessageRead: $oldestMessageRead) {
      type
      shopId
      appClientId
      eventTimestamp
      payload {
        logs
        functionId
        input
        inputBytes
        output
        outputBytes
        invocationId
        errorType
        errorMessage
        fuelConsumed
      }
    }
  }
`

export function setupAppEventsSubscribeProcess({
  partnersSessionToken,
  subscription: {shopIds, apiKey},
  prefix,
}: Props): AppEventsSubscribeProcess | undefined {
  return {
    type: 'app-events-subscribe',
    prefix,
    function: subscribeToAppEvents,
    options: {
      shopIds,
      apiKey,
      token: partnersSessionToken,
    },
  }
}

export const subscribeToAppEvents: DevProcessFunction<AppEventsQueryOptions> = async ({stdout}, options) => {
  const result = await partnersRequest<{
    appLogsSubscribe: {jwtToken: string; success: boolean; errors: string[]}
  }>(AppEventsSubscribeMutation, options.token, {
    input: {shopIds: options.shopIds, apiKey: options.apiKey},
  })

  stdout.write(`Subscribed to App Events for SHOP ID ${options.shopIds} Api Key ${options.apiKey}\n`)

  stdout.write(`Checking for AppEvents logs\n`)

  console.log(result.appLogsSubscribe)

  const currentJwtToken = result.appLogsSubscribe.jwtToken

  const fetchLogsResult = await partnersRequest<{
    appLogs: {
      type: string
      shopIds: string
      appClientId: string
      eventTimestamp: string
      payload: {functionId: string}
    }[]
  }>(FetchAppLogsQuery, options.token, {
    jwtToken: currentJwtToken,
    oldestMessageRead: new Date().toISOString(),
  })

  console.log(currentJwtToken)

  fetchLogsResult.appLogs.forEach((event) => {
    stdout.write(`Event Streamed\n`)
    stdout.write(`Event Type: ${event.type}\n`)
    stdout.write(`Shop ID: ${event.shopIds[0]}\n`)
    stdout.write(`App Client ID: ${event.appClientId}\n`)
    stdout.write(`Event Timestamp: ${event.eventTimestamp}\n`)
    stdout.write(`Payload: ${JSON.stringify(event.payload, null, 2)}\n`)
  })

  let lastReadTime = new Date().toISOString()
  // TODO: This is a temporary solution to poll for app events
  const appEventsRequest = async () => {
    const fetchLogsResult = await partnersRequest<{
      appLogs: {
        type: string
        shopIds: [string]
        appClientId: string
        eventTimestamp: string
        payload: AppLog
      }[]
    }>(FetchAppLogsQuery, options.token, {
      jwtToken: currentJwtToken,
      oldestMessageRead: lastReadTime,
    })
    // console.log('fetchLogsResult', fetchLogsResult)

    // console.log(fetchLogsResult)
    const functionErrorOutput = ({
      event,
    }: {
      event: {
        type: string
        shopIds: [string]
        appClientId: string
        eventTimestamp: string
        payload: AppLog
      }
    }) => {
      const part1 = `❌ ${
        event.type === 'function-run' ? 'Function' : 'other?'
      } my-product-discount failed to execute: ${event.payload.errorType}`
      const part2 = event.payload.logs || 'no logs found'
      const part25 = event.payload.errorMessage
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
        shopIds: [string]
        appClientId: string
        eventTimestamp: string
        payload: AppLog
      }
    }) => {
      const part1 = `✅ ${event.type === 'function-run' ? 'Function' : 'other?'} executed in ${
        event.payload?.fuelConsumed
      } instructions:`
      const part2 = event.payload.logs
      const part3 = 'some more custom logging about discounting'
      const part4 = 'Log: /~/my-product-discount'
      stdout.write(part1)
      stdout.write(part2)
      stdout.write(part3)
      stdout.write(part4)
    }

    fetchLogsResult.appLogs.forEach((event) => {
      if (event.payload.errorMessage) {
        functionErrorOutput({event})
      } else {
        functionSuccessOutput({event})
      }
      lastReadTime = new Date().toISOString()
    })
  }

  const startPolling = () => {
    return setInterval(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      () => appEventsRequest(),
      2000,
    )
  }
  await startPolling()
}

interface AppLog {
  functionId?: string
  input?: string
  inputBytes?: number
  output?: string
  outputBytes?: number
  invocationId?: string
  errorMessage?: string
  errorType?: string
  logs?: string
  fuelConsumed?: number
}
