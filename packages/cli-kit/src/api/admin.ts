import {buildHeaders} from './common'
import {AdminSession} from '../session'
import {debug} from '../output'
import {request as graphqlRequest, gql, RequestDocument, Variables} from 'graphql-request'

export async function request<T>(query: RequestDocument, session: AdminSession, variables?: Variables): Promise<T> {
  debug(`
Sending Admin GraphQL request:
${query}

With variables:
${variables ? JSON.stringify(variables, null, 2) : ''}
  `)
  const version = await fetchApiVersion(session)
  const url = adminUrl(session.storeFqdn, version)
  const headers = await buildHeaders(session.token)
  return graphqlRequest<T>(url, query, variables, headers)
}

async function fetchApiVersion(session: AdminSession): Promise<string> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(session.token)

  debug(`
Sending Admin GraphQL request to URL ${url} with query:
${query}
  `)
  const data = await graphqlRequest<{
    publicApiVersions: {handle: string; supported: boolean}[]
  }>(url, query, {}, headers)
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
