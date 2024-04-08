import {gql} from 'graphql-request'

export const ThemeExtensionUpdateDraftMutation = gql`
  mutation ThemeExtensionUpdateDraft(
    $apiKey: String!
    $registrationId: ID!
    $config: JSON!
    $context: String
    $handle: String
  ) {
    extensionUpdateDraft(
      input: {apiKey: $apiKey, registrationId: $registrationId, config: $config, context: $context, handle: $handle}
    ) {
      extensionVersion {
        config
        registrationId
        context
        lastUserInteractionAt
        location
        validationErrors {
          field
          message
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface ThemeExtensionUpdateDraftInput {
  apiKey: string
  config: string
  handle: string
  registrationId: string
}

export interface ThemeExtensionUpdateDraftPayload {
  extensionVersion: {
    registrationId: string
    config: string
    context: string
    lastUserInteractionAt: string
    location: string
    validationErrors: {
      field: string
      message: string
    }[]
  }
  userErrors: {
    field: string[]
    message: string
  }[]
}

export interface ThemeExtensionUpdateSchema {
  extensionUpdateDraft: ThemeExtensionUpdateDraftPayload
}
