import {buildHeaders} from './common'
import {partners as partnersFqdn} from '../environment/fqdn'
import {debug} from '../output'
import {request as graphqlRequest, Variables, RequestDocument} from 'graphql-request'

export async function request<T>(query: RequestDocument, token: string, variables?: Variables): Promise<T> {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const headers = await buildHeaders(token)
  debug(`
Sending Partners GraphQL request:
${query}

With variables:
${variables ? JSON.stringify(variables, null, 2) : ''}
  `)
  return graphqlRequest<T>(url, query, variables, headers)
}
