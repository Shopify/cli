import {gql} from 'graphql-request'

export const TargetSchemaDefinitionQuery = gql`
  query TargetSchemaDefinitionQuery($apiKey: String!, $version: String!, $target: String!) {
    definition: functionTargetSchemaDefinition(apiKey: $apiKey, version: $version, target: $target)
  }
`

export interface TargetSchemaDefinitionQuerySchema {
  definition: string | null
}

export interface TargetSchemaDefinitionQueryVariables {
  apiKey: string
  version: string
  target: string
}
