import {gql} from 'graphql-request'

export const ApiSchemaDefinitionQuery = gql`
  query ApiSchemaDefinitionQuery($apiKey: String!, $version: String!, $type: String!) {
    definition: functionApiSchemaDefinition(apiKey: $apiKey, version: $version, type: $type)
  }
`

export interface ApiSchemaDefinitionQuerySchema {
  definition: string | null
}

export interface ApiSchemaDefinitionQueryVariables {
  apiKey: string
  version: string
  type: string
}
