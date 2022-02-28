import {randomUUID} from 'crypto'

import {request, gql, GraphQLClient} from 'graphql-request'

import {ApplicationToken} from '../session/schema'
import {currentVersion, latestNpmPackageVersion} from '../version'
import {shopify} from '../environment/fqdn'

export async function query(
  query: any,
  token: ApplicationToken,
  shop: string,
  variables: any,
): Promise<unknown> {
  const fqdn = await shopify({storeFqdn: shop})
  const version = ''
  const url = `${fqdn}/admin/api/${version}/graphql.json`
  const headers = await buildHeaders(token.accessToken)
  return request(url, query, variables, headers)
}

async function buildHeaders(token: string): Promise<{[key: string]: any}> {
  const version = await currentVersion('cli')
  const userAgent = `Shopify CLI; v=${'2'}`
  const sha = 'something'
  const secCHUA = `${userAgent} sha=${sha}`
  const isEmployee = true

  const headers = {
    'User-Agent': userAgent,
    'Sec-CH-UA': secCHUA,
    'Sec-CH-UA-PLATFORM': process.platform,
    'X-Request-Id': randomUUID(),
    authorization: token,
    'X-Shopify-Access-Token': token,
    ...(isEmployee && {'X-Shopify-Cli-Employee': '1'}),
  }

  return headers
}

export async function fetchApiVersion(token: string, shop: string) {
  const fqdn = await shopify({storeFqdn: shop})
  const url = `${fqdn}/admin/api/unstable/graphql.json`

  const query = gql`
    query {
      publicApiVersions {
        handle
        supported
      }
    }
  `
  const requestHeaders = await buildHeaders(token)
  console.log(requestHeaders)

  const client = new GraphQLClient(url, {
    headers: {'X-Shopify-Access-Token': token},
  })

  client.setHeaders(requestHeaders)

  const variables = {
    title: 'Inception',
  }

  return client.request(query, variables, requestHeaders).then((res) => {
    return res.publicApiVersions
      .filter((item: any) => item.supported)
      .map((item: any) => item.handle)
      .sort()
      .reverse()[0]
  })
}
