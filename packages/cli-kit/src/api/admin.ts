import {request as graphqlRequest, gql} from 'graphql-request'

import {ApplicationToken} from '../session/schema'

import {buildHeaders} from './common'

export async function request<T>(query: any, token: ApplicationToken, store: string, variables?: any): Promise<T> {
  const version = await fetchApiVersion(token.accessToken, store)
  const url = adminUrl(store, version)
  const headers = await buildHeaders(token.accessToken)
  return graphqlRequest<T>(url, query, variables, headers)
}

async function fetchApiVersion(token: string, store: string): Promise<any> {
  const url = adminUrl(store, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(token)

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
