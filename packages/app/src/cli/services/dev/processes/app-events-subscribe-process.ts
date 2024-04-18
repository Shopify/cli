import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppEventsQueryOptions {
  shopId: string
  apiKey: string
  token: string
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
  const result = await partnersRequest(AppEventsSubscribeMutation, options.token, {
    input: {shopId: options.shopId, apiKey: options.apiKey},
  })
  console.log('[subscribeToAppEvents](AppEventsSubscribeMutation) result: ', result)

  stdout.write(`Subscribed to App Events for SHOP ID ${options.shopId} Api Key ${options.apiKey}\n`)
}
// console.log('result', result)
// const objString = JSON.stringify(result)
// stdout.write(`Result: ${objString}\n`)
