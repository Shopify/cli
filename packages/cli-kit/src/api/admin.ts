import {buildHeaders, debugLogRequest, handlingErrors} from './common.js'
import {AdminSession} from '../session.js'
import {debug, content, token as outputToken} from '../output.js'
import {Bug, Abort} from '../error.js'
import {graphqlClient} from '../http/graphql.js'
import {gql, RequestDocument, Variables} from 'graphql-request'

export async function request<T>(query: RequestDocument, session: AdminSession, variables?: Variables): Promise<T> {
  const api = 'Admin'
  return handlingErrors(api, async () => {
    const version = await fetchApiVersion(session)
    const url = adminUrl(session.storeFqdn, version)
    const headers = await buildHeaders(session.token)
    const client = await graphqlClient({headers, url})
    debugLogRequest(api, query, variables, headers)
    const response = await client.request<T>(query, variables)
    return response
  })
}

async function fetchApiVersion(session: AdminSession): Promise<string> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(session.token)
  const client = await graphqlClient({url, headers})
  debug(`
Sending Admin GraphQL request to URL ${url} with query:
${query}
  `)
  const data = await client
    .request<{
      publicApiVersions: {handle: string; supported: boolean}[]
    }>(query, {})
    .catch((err) => {
      if (err.response.status === 403) {
        const storeName = session.storeFqdn.replace('.myshopify.com', '')
        throw new Abort(
          content`Looks like you don't have access this dev store: (${outputToken.link(
            storeName,
            `https://${session.storeFqdn}`,
          )})`,
          content`If you're not the owner, create a dev store staff account for yourself`,
        )
      }
      throw new Bug(`Unknown error connecting to your store`)
    })

  return data.publicApiVersions
    .filter((item) => item.supported)
    .map((item) => item.handle)
    .sort()
    .reverse()[0]!
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
