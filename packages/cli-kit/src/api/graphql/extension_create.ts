import {gql} from 'graphql-request'

export const ExtensionCreateQuery = gql`
  mutation ExtensionCreate($apiKey: String!, $type: ExtensionType!, $title: String!, $config: JSON!, $context: String) {
    extensionCreate(input: {apiKey: $apiKey, type: $type, title: $title, config: $config, context: $context}) {
      extensionRegistration {
        id
        uuid
        type
        title
        draftVersion {
          registrationId
          lastUserInteractionAt
          validationErrors {
            field
            message
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface ExtensionCreateVariables {
  apiKey: string
  type: string
  title: string
  config: string
  context?: string | null
}

export interface ExtensionCreateSchema {
  extensionCreate: {
    extensionRegistration: {
      id: string
      uuid: string
      type: string
      title: string
      draftVersion: {
        registrationId: string
        lastUserInteractionAt: string
        validationErrors: {
          field: string[]
          message: string
        }[]
      }
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
