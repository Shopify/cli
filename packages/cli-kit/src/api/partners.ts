import {buildHeaders} from './common'
import {partners as partnersFqdn} from '../environment/fqdn'
import {request as graphqlRequest} from 'graphql-request'

export async function request<T>(query: any, token: string, variables?: any): Promise<T> {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const headers = await buildHeaders(token)
  return graphqlRequest<T>(url, query, variables, headers)
}
