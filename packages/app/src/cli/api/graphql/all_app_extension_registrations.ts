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
          config
        }
      }
      dashboardManagedExtensionRegistrations {
        id
        uuid
        title
        type
        activeVersion {
          config
        }
        draftVersion {
          config
        }
      }
    }
  }
`

export interface AllAppExtensionRegistrationsQueryVariables {
  apiKey: string
}

export interface ExtensionRegistration {
  id: string
  uuid: string
  title: string
  type: string
  draftVersion?: {
    config: string
  }
  activeVersion?: {
    config: string
  }
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: {
    extensionRegistrations: ExtensionRegistration[]
    dashboardManagedExtensionRegistrations: ExtensionRegistration[]
  }
}
