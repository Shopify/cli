import {gql} from 'graphql-request'

export const AllAppExtensionRegistrationsQuery = gql`
  query allAppExtensionRegistrations($apiKey: String!) {
    app(apiKey: $apiKey) {
      extensionRegistrations {
        id
        uuid
        title
        type
        draftVersion {
          config
        }
      }
      functions {
        id
        uuid
        title
        type: apiType
      }
    }
  }
`

export interface AllAppExtensionRegistrationsQueryVariables {
  apiKey: string
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: {
    extensionRegistrations: {
      id: string
      uuid: string
      title: string
      type: string
      draftVersion?: {
        config: string
        registrationId: string
        lastUserInteractionAt: string
        validationErrors: {
          field: string[]
          message: string
        }[]
      }
    }[]
    functions: {
      id: string
      uuid: string
      title: string
      type: string
    }[]
  }
}
