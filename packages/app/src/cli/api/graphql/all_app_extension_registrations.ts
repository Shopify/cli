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
          context
        }
        activeVersion {
          config
          context
        }
      }
      configurationRegistrations {
        id
        uuid
        title
        type
        draftVersion {
          config
          context
        }
        activeVersion {
          config
          context
        }
      }
      dashboardManagedExtensionRegistrations {
        id
        uuid
        title
        type
        activeVersion {
          config
          context
        }
        draftVersion {
          config
          context
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
    context?: string
  }
  activeVersion?: {
    config: string
    context?: string
  }
}

export interface RemoteExtensionRegistrations {
  extensionRegistrations: ExtensionRegistration[]
  configurationRegistrations: ExtensionRegistration[]
  dashboardManagedExtensionRegistrations: ExtensionRegistration[]
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: RemoteExtensionRegistrations
}
