import {buildHeaders} from './common'
import {AdminSession} from '../session'
import {debug} from '../output'
import {request as graphqlRequest, gql} from 'graphql-request'

export async function request<T>(query: any, session: AdminSession, variables?: any): Promise<T> {
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

async function fetchApiVersion(session: AdminSession): Promise<any> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(session.token)

  debug(`
Sending Admin GraphQL request to URL ${url} with query:
${query}
  `)
  const data = await graphqlRequest(url, query, {}, headers)
  return data.publicApiVersions
    .filter((item: any) => item.supported)
    .map((item: any) => item.handle)
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
