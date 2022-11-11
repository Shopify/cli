/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticatedFetch as appBridgeFetch} from '@shopify/app-bridge-utils'
import {Redirect} from '@shopify/app-bridge/actions'
import {http} from '@shopify/cli-kit'
import createApp from '@shopify/app-bridge'

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable tsdoc/syntax */
/**
 * This function sends an authenticated query to the GraphQL API of the store.
 * @param query The GraphQL query that will be sent to the store's GraphQL API.
 * @param variables The variables to include when sending a GraphQL mutation.
 * @returns
 */
export async function adminGraphQLFetch(query: string, variables: any = {}): Promise<any> {}

/**
 * A hook that returns an auth-aware fetch function.
 * @desc The returned fetch function that matches the browser's fetch API
 * See: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 * It will provide the following functionality:
 *
 * 1. Add a `X-Shopify-Access-Token` header to the request.
 * 2. Check response for `X-Shopify-API-Request-Failure-Reauthorize` header.
 * 3. Redirect the user to the reauthorization URL if the header is present.
 *
 * @returns {Function} fetch function
 */
export async function authenticatedFetch(...options: Parameters<typeof http.fetch>) {
  const appBridge = createAppBridge()
  const fetchFunction = appBridgeFetch(appBridge)
  const response = await fetchFunction(...options)
  checkHeadersForReauthorization(response.headers, appBridge)
  return response
}

function createAppBridge() {
  // @ts-ignore
  const host = new URLSearchParams(location.search).get('host') || window.__SHOPIFY_DEV_HOST
  // @ts-ignore
  window.__SHOPIFY_DEV_HOST = host

  const config = {
    apiKey: process.env.SHOPIFY_API_KEY as string,
    host,
    forceRedirect: true,
  }
  const app = createApp(config)
  return app
}

function checkHeadersForReauthorization(headers: any, app: any) {
  if (headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const authUrlHeader = headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') || `/api/auth`

    const redirect = Redirect.create(app)
    redirect.dispatch(
      Redirect.Action.REMOTE,
      // @ts-ignore
      authUrlHeader.startsWith('/') ? `https://${window.location.host}${authUrlHeader}` : authUrlHeader,
    )
  }
}
