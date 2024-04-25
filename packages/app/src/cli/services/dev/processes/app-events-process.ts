import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppEventsQueryOptions {
  shopId: string
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
    shopId: string
    apiKey: string
  }
  prefix: string
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

const FetchAppEventsQuery = gql`
  query FetchAppEvents($jwtToken: String!, $oldestMessageRead: String!) {
    appEvents(jwtToken: $jwtToken, oldestMessageRead: $oldestMessageRead) {
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
  subscription: {shopId, apiKey},
  prefix,
}: Props): AppEventsSubscribeProcess | undefined {
  return {
    type: 'app-events-subscribe',
    prefix,
    function: subscribeToAppEvents,
    options: {
      shopId,
      apiKey,
      token: partnersSessionToken,
    },
  }
}

export const subscribeToAppEvents: DevProcessFunction<AppEventsQueryOptions> = async ({stdout}, options) => {
  const result = await partnersRequest<{
    appEventsSubscribe: {jwtToken: string; success: boolean; errors: string[]}
  }>(AppEventsSubscribeMutation, options.token, {
    input: {shopId: options.shopId, apiKey: options.apiKey},
  })

  stdout.write(`Subscribed to App Events for SHOP ID ${options.shopId} Api Key ${options.apiKey}\n`)

  stdout.write(`Checking for AppEvents logs\n`)

  const currentJwtToken = result.appEventsSubscribe.jwtToken

  const fetchLogsResult = await partnersRequest<{
    appEvents: {
      type: string
      shopId: string
      appClientId: string
      eventTimestamp: string
      payload: {functionId: string}
    }[]
  }>(FetchAppEventsQuery, options.token, {
    jwtToken: currentJwtToken,
    oldestMessageRead: new Date().toISOString(),
  })

  // console.log(fetchLogsResult)

  fetchLogsResult.appEvents.forEach((event) => {
    stdout.write(`Event Streamed\n`)
    stdout.write(`Event Type: ${event.type}\n`)
    stdout.write(`Shop ID: ${event.shopId}\n`)
    stdout.write(`App Client ID: ${event.appClientId}\n`)
    stdout.write(`Event Timestamp: ${event.eventTimestamp}\n`)
    stdout.write(`Payload: ${JSON.stringify(event.payload, null, 2)}\n`)
  })

  let lastReadTime = new Date().toISOString()
  // TODO: This is a temporary solution to poll for app events
  const appEventsRequest = async () => {
    const fetchLogsResult = await partnersRequest<{
      appEvents: {
        type: string
        shopId: string
        appClientId: string
        eventTimestamp: string
        payload: AppEvent
      }[]
    }>(FetchAppEventsQuery, options.token, {
      jwtToken: currentJwtToken,
      oldestMessageRead: lastReadTime,
    })

    // console.log(fetchLogsResult)
    const functionErrorOutput = ({
      event,
    }: {
      event: {
        type: string
        shopId: string
        appClientId: string
        eventTimestamp: string
        payload: AppEvent
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
        shopId: string
        appClientId: string
        eventTimestamp: string
        payload: AppEvent
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

    fetchLogsResult.appEvents.forEach((event) => {
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

interface AppEvent {
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
