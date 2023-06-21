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
        activeVersion {
          id
          uuid
          versionTag
        }
      }
      dashboardManagedExtensionRegistrations {
        id
        uuid
        title
        type
        # activeVersion {
        #   id
        #   uuid
        #   config
        # }
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

interface ExtensionRegistration {
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
  activeVersion?: {
    id: string
    uuid: string
    config: string
  }
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: {
    extensionRegistrations: ExtensionRegistration[]
    dashboardManagedExtensionRegistrations: ExtensionRegistration[]
    functions: ExtensionRegistration[]
  }
}
