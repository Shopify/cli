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
  query FetchAppEvents($jwtToken: String!) {
    appEvents(jwtToken: $jwtToken) {
      type
      shopId
      appClientId
      eventTimestamp
      payload {
        functionId
        input
        inputBytes
        output
        outputBytes
        invocationId
        errorMessage
        errorType
      }
    }
  }
`

export function setupAppEventsSubscribeProcess({
  partnersSessionToken,
  subscription: {shopId, apiKey},
}: Props): AppEventsSubscribeProcess | undefined {
  return {
    type: 'app-events-subscribe',
    prefix: 'app-events',
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
  })

  console.log(fetchLogsResult)

  fetchLogsResult.appEvents.forEach((event) => {
    stdout.write(`Event Streamed\n`)
    stdout.write(`Event Type: ${event.type}\n`)
    stdout.write(`Shop ID: ${event.shopId}\n`)
    stdout.write(`App Client ID: ${event.appClientId}\n`)
    stdout.write(`Event Timestamp: ${event.eventTimestamp}\n`)
    stdout.write(`Payload: ${JSON.stringify(event.payload, null, 2)}\n`)
  })

  // TODO:
  const appEventsRequest = async () => {
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
    })

    console.log(fetchLogsResult)

    fetchLogsResult.appEvents.forEach((event) => {
      stdout.write(`Option 1: Set Interval from inside the process function\n`)
      stdout.write(`Event Streamed\n`)
      stdout.write(`Event Type: ${event.type}\n`)
      stdout.write(`Shop ID: ${event.shopId}\n`)
      stdout.write(`App Client ID: ${event.appClientId}\n`)
      stdout.write(`Event Timestamp: ${event.eventTimestamp}\n`)
      stdout.write(`Payload: ${JSON.stringify(event.payload, null, 2)}\n`)
    })
  }

  const startPolling = () => {
    return setInterval(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      () => appEventsRequest(),
      450,
    )
  }
  await startPolling()
}
