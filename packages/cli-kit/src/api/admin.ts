import {buildHeaders, debugLogRequest, handlingErrors} from './common.js'
import {AdminSession} from '../session.js'
import {debug, content, token as outputToken} from '../output.js'
import {Bug, Abort, ManagedError} from '../error.js'
import {graphqlClient} from '../http/graphql.js'
import {gql, RequestDocument, Variables} from 'graphql-request'
import {ResultAsync} from 'neverthrow'

const UnauthorizedAccessError = (store: string) => {
  const adminLink = outputToken.link(`URL`, `https://${store}/admin`)
  const storeName = store.replace('.myshopify.com', '')
  return new Abort(
    content`Looks like you need access to this dev store (${outputToken.link(storeName, `https://${store}`)})`,
    content`• Log in to the store directly from this ${adminLink}. If you're the store owner, then that direct log in should solve your access issue.
• If you're not the owner, create a dev store staff account for yourself. Then log in directly from the link above.
    `,
  )
}

const UnknownError = () => {
  return new Bug(`Unknown error connecting to your store`)
}

export function request<T>(
  query: RequestDocument,
  session: AdminSession,
  variables?: Variables,
): ResultAsync<T, ManagedError> {
  const api = 'Admin'
  return handlingErrors(api, async () => {
    const version = await fetchApiVersion(session)
    const url = adminUrl(session.storeFqdn, version)
    const headers = await buildHeaders(session.token)
    const client = await graphqlClient({
      headers,
      url,
      service: 'shopify',
    })
    debugLogRequest(api, query, variables, headers)
    const response = await client.request<T>(query, variables)
    return response
  })
}

async function fetchApiVersion(session: AdminSession): Promise<string> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(session.token)
  const client = await graphqlClient({url, headers, service: 'shopify'})
  debug(`
Sending Admin GraphQL request to URL ${url} with query:
${query}
  `)
  const data = await client
    .request<{
      publicApiVersions: {handle: string; supported: boolean}[]
    }>(query, {})
    .catch((err) => {
      throw err.response.status === 403 ? UnauthorizedAccessError(session.storeFqdn) : UnknownError()
    })

  return data.publicApiVersions
    .filter((item) => item.supported)
    .map((item) => item.handle)
    .sort()
    .reverse()[0]
}

function adminUrl(store: string, version: string | undefined): string {
  const realVersion = version || 'unstable'
  return `https://${store}/admin/api/${realVersion}/graphql.json`
}

function apiVersionQuery(): string {
  return gql`
    query {
      publicApiVersions {
        handle
        supported
      }
    }
  `
}
