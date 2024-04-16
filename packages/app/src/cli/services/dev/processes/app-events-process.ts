import {BaseProcess, DevProcessFunction} from './types.js'

export interface AppEventsQueryOptions {
  shopId: number
  appId: number
}

export interface AppEventsSubscribeProcess extends BaseProcess<AppEventsQueryOptions> {
  type: 'app-events-subscribe'
}

interface Props {
  test: string
}

export function setupAppEventsSubscribeProcess({test}: Props): AppEventsSubscribeProcess | undefined {
  console.log('[setupAppEventsSubscribeProcess] might need to pass data here evntually....', test)
  return {
    type: 'app-events-subscribe',
    prefix: 'app-events',
    function: subscribeToAppEvents,
    options: {
      shopId: 1,
      appId: 1,
    },
  }
}

export const subscribeToAppEvents: DevProcessFunction<AppEventsQueryOptions> = async ({stdout}, options) => {
  console.log('[subscribeToAppEvents] Querying app events', options.shopId, options.appId)

  // const result: FindAppFunctionLogsQuerySchema = await fetchFunctionLogs('123', '123', options.token)
  // console.log('result', result)
  stdout.write('Subscribed to Log Streaming for App ID 123-456-789 Shop ID 1\n')
  // const objString = JSON.stringify(result)
  // stdout.write(`Result: ${objString}\n`)
}

// export async function fetchFunctionLogs(
//   functionId: string,
//   apiKey: string,
//   token: string,
// ): Promise<FindAppFunctionLogsQuerySchema> {
//   try {
//     const result: FindAppFunctionLogsQuerySchema = await partnersRequest(FindAppFunctionLogs, token)
//     console.log('result', result)
//     return result
//   } catch (e) {
//     console.error(`error: ${e}`)
//     // Handle error or return a default value if needed
//     return {appEvents: []}
//   }
// }

// interface FindAppFunctionLogsQuerySchema {
//   appEvents: string[]
// }

// const FindAppFunctionLogs = gql`
//   query FindAppFunctionLogs {
//     appEvents
//   }
// `
