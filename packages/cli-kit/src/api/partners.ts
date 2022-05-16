import {buildHeaders} from './common'
import {partners as partnersFqdn} from '../environment/fqdn'
import {debug} from '../output'
import {request as graphqlRequest} from 'graphql-request'

export async function request<T>(query: any, token: string, variables?: any): Promise<T> {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const headers = await buildHeaders(token)
  debug(`
  Sending Partners GraphQL request:
  ${query}

  With variables:
  ${variables}
  `)
  return graphqlRequest<T>(url, query, variables, headers)
}
