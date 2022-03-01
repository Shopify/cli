import {request, gql} from 'graphql-request'

import {ApplicationToken} from '../session/schema'
import {partners} from '../environment/fqdn'

import {buildHeaders} from './common'

export async function query<T>(
  query: any,
  token: ApplicationToken,
  variables: any,
): Promise<T> {
  const url = await partners()
  const headers = await buildHeaders(token.accessToken)
  return request<T>(url, query, variables, headers)
}
