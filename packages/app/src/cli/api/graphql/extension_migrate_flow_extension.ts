import {gql} from 'graphql-request'

export const MigrateFlowExtensionMutation = gql`
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

export interface MigrateFlowExtensionVariables {
  apiKey: string
  registrationId: string
}

export interface MigrateFlowExtensionSchema {
  migrateFlowExtension: {
    migratedFlowExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
