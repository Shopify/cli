/* eslint-disable tsdoc/syntax */
/**
 * This function sends an authenticated query to the GraphQL API of the store.
 * @param query The GraphQL query that will be sent to the store's GraphQL API.
 * @param variables The variables to include when sending a GraphQL mutation.
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function graphqlRequest(query: string, variables: any = {}): Promise<any> {
  const authenticationHeaders = {'X-Shopify-Access-Token': process.env._SHOPIFY_APP_TOKEN}
  const url = `https://${process.env._SHOPIFY_STORE_FQDN}/admin/api/${process.env._SHOPIFY_API_VERSION}/graphql.json`
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...authenticationHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })
  return response.json()
}
