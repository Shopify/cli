import {gql} from 'graphql-request'

export const ScriptServiceProxyQuery = gql`
  query ProxyRequest($api_key: String, $query: String!, $variables: String) {
    scriptServiceProxy(apiKey: $api_key, query: $query, variables: $variables)
  }
`

export interface ScriptServiceProxyQuerySchema {
  scriptServiceProxy: unknown
}
