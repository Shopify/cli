import {gql} from 'graphql-request'

export const ExtensionMigrateFlowExtensionQuery = gql`
  mutation MigrateFlowExtension($apiKey: String!, $registrationId: ID!) {
    migrateFlowExtension(input: {apiKey: $apiKey, registrationId: $registrationId}) {
      migratedFlowExtension
      userErrors {
        field
        message
      }
    }
  }
`

export interface ExtensionMigrateFlowExtensionVariables {
  apiKey: string
  registrationId: string
}

export interface ExtensionMigrateFlowExtensionSchema {
  migrateFlowExtension: {
    migratedFlowExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
