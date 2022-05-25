import {gql} from 'graphql-request'

export const AllAppExtensionRegistrationsQuery = gql`
  query allAppExtensionRegistrations($apiKey: String!) {
    app(apiKey: $apiKey) {
      extensionRegistrations {
        id
        uuid
        title
        type
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
    }[]
  }[]
}
