import {buildHeaders} from './common'
import {AdminSession} from '../session'
import {request as graphqlRequest, gql} from 'graphql-request'

export async function request<T>(query: any, session: AdminSession, variables?: any): Promise<T> {
  const version = await fetchApiVersion(session)
  const url = adminUrl(session.store, version)
  const headers = await buildHeaders(session.token)
  return graphqlRequest<T>(url, query, variables, headers)
}

async function fetchApiVersion(session: AdminSession): Promise<any> {
  const url = adminUrl(session.store, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(session.token)

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

function adminRestUrl(store: string, version: string | undefined, path: string): string {
  const realVersion = version || 'unstable'
  return `https://${store}/admin/api/${realVersion}/${path}}`
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
