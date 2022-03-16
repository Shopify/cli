import {request as graphqlRequest} from 'graphql-request'

import {ApplicationToken} from '../session/schema'
import {partners as partnersFqdn} from '../environment/fqdn'
import {PartnersAPIToken} from '../session'

import {buildHeaders} from './common'

export async function request<T>(query: any, token: PartnersAPIToken, variables?: any): Promise<T> {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const headers = await buildHeaders(token)
  return graphqlRequest<T>(url, query, variables, headers)
}
