import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppEventsQueryOptions {
  shopId: string
  appId: string
  token: string
}

export interface AppEventsSubscribeProcess extends BaseProcess<AppEventsQueryOptions> {
  type: 'app-events-subscribe'
}

interface Props {
  partnersSessionToken: string
  subscription: {
    shopId: string
    appId: string
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

export function setupAppEventsSubscribeProcess({
  partnersSessionToken,
  subscription: {shopId, appId},
}: Props): AppEventsSubscribeProcess | undefined {
  return {
    type: 'app-events-subscribe',
    prefix: 'app-events',
    function: subscribeToAppEvents,
    options: {
      shopId,
      appId,
      token: partnersSessionToken,
    },
  }
}

export const subscribeToAppEvents: DevProcessFunction<AppEventsQueryOptions> = async ({stdout}, options) => {
  console.log('[subscribeToAppEvents] Subscribing to App Events for', options.shopId, options.appId)
  console.log('[subscribeToAppEvents] token needed for mutation:', options.token)

  const result = await partnersRequest(AppEventsSubscribeMutation, options.token, {
    input: {shopId: options.shopId, appId: options.appId},
  })
  console.log('[subscribeToAppEvents] result: ', result)
  stdout.write(`Subscribed to App Events for SHOP ID ${options.shopId} APP ID ${options.appId}\n`)
}
// console.log('result', result)
// const objString = JSON.stringify(result)
// stdout.write(`Result: ${objString}\n`)
