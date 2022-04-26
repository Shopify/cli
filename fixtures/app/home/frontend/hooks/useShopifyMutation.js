import { getSessionToken } from '@shopify/app-bridge-utils'
import { useAppBridge } from '@shopify/app-bridge-react'
import { Redirect } from '@shopify/app-bridge/actions'
import { useMutation } from 'react-query'
import { rawRequest } from 'graphql-request'

export const useShopifyMutation = (query) => {
  const app = useAppBridge()

  const {mutateAsync, ...mutationProps} = useMutation(
    async (variables) => {
      const sessionToken = await getSessionToken(app)
      const headers = new Headers({})

      headers.append('Authorization', `Bearer ${sessionToken}`)
      headers.append('X-Requested-With', 'XMLHttpRequest')
      const response = await rawRequest('/api/graphql', query, variables, headers)
      checkHeadersForReauthorization(response.headers, app)

      return response
    }, 
    {
      onError: (result) => {
        const {response} = result
        checkHeadersForReauthorization(response.headers, app)
      },
    },
  )

  return [mutateAsync, mutationProps]
}


const checkHeadersForReauthorization = (headers, app) => {
  if (headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const authUrlHeader = headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url')

    const redirect = Redirect.create(app)
    redirect.dispatch(Redirect.Action.APP, authUrlHeader || `/api/auth`)
  }
}
