import {GraphQLVariables, graphqlRequest} from './graphql.js'
import {handleDeprecations} from './partners.js'
import {businessPlatformFqdn} from '../context/fqdn.js'

/**
 * Executes a GraphQL query against the Business Platform Destinations API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Business Platform token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function businessPlatformRequest<T>(
  query: string,
  token: string,
  variables?: GraphQLVariables,
): Promise<T> {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const url = `https://${fqdn}/destinations/api/2020-07/graphql`
  return graphqlRequest({
    query,
    api,
    url,
    token,
    variables,
    responseOptions: {onResponse: handleDeprecations},
  })
}

/**
 * Executes a GraphQL query against the Business Platform Organizations API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Business Platform token.
 * @param organizationId - Organization ID as a numeric value.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function businessPlatformOrganizationsRequest<T>(
  query: string,
  token: string,
  organizationId: string,
  variables?: GraphQLVariables,
): Promise<T> {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const url = `https://${fqdn}/organizations/api/unstable/organization/${organizationId}/graphql`
  return graphqlRequest({
    query,
    api,
    url,
    token,
    variables,
    responseOptions: {onResponse: handleDeprecations},
  })
}
