import {request as graphqlRequest} from 'graphql-request'

import {ApplicationToken} from '../session/schema'
import {partners as partnersFqdn} from '../environment/fqdn'

import {buildHeaders} from './common'

export async function request<T>(query: any, token: ApplicationToken, variables?: any): Promise<T> {
  const url = await partnersFqdn()
  const headers = await buildHeaders(token.accessToken)
  return graphqlRequest<T>(url, query, variables, headers)
}
