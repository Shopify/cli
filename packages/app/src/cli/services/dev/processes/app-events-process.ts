import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppEventsQueryOptions {
  shopId: number
  appId: number
  token: string
}

export interface AppEventsSubscribeProcess extends BaseProcess<AppEventsQueryOptions> {
  type: 'app-events-subscribe'
}

interface Props {
  partnersSessionToken: string
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

export function setupAppEventsSubscribeProcess({partnersSessionToken}: Props): AppEventsSubscribeProcess | undefined {
  console.log('[setupAppEventsSubscribeProcess] cliToken:', partnersSessionToken)
  const result = partnersRequest(AppEventsSubscribeMutation, partnersSessionToken, {
    input: {shopId: 1, appId: 1},
  })
  console.log(result)
  return {
    type: 'app-events-subscribe',
    prefix: 'app-events',
    function: subscribeToAppEvents,
    options: {
      shopId: 1,
      appId: 1,
      token: partnersSessionToken,
    },
  }
}

export const subscribeToAppEvents: DevProcessFunction<AppEventsQueryOptions> = async ({stdout}, options) => {
  console.log('[subscribeToAppEvents] Subscribing to App Events for', options.shopId, options.appId)
  console.log('[subscribeToAppEvents] token needed for mutation:', options.token)

  console.log('ATTEMPTING PARETNERS REQUEST')
  const result = await partnersRequest(AppEventsSubscribeMutation, options.token, {
    input: {shopId: options.shopId, appId: options.appId},
  })
  console.log(result)
  stdout.write('Subscribed to Log Streaming for App ID 123-456-789 Shop ID 1\n')
}

// const result: FindAppFunctionLogsQuerySchema = await fetchFunctionLogs('123', '123', options.token)
// console.log('result', result)
// const objString = JSON.stringify(result)
// stdout.write(`Result: ${objString}\n`)

// const subscribeToAppEventsRequest = async (
//   shopId: number,
//   appId: number,
// ): Promise<{
//   success: boolean
//   errors: string[]
//   jwtToken: string
// }> => {
//   return await partnersRequest({})
// }
