import {gql} from 'graphql-request'

export const FetchExtensionQuery = gql`
  query fetchSpecifications($uuid: String!, $appId: String!, $type: String!) {
    extension(uuid: $uuid, appId: $appId, type: $type) {
      id
      uuid
      type
      config
    }
  }
`

export interface FetchExtensionQueryVariables {
  uuid: string
  appId: string
  type: string
}

export interface FetchExtensionQuerySchema {
  extension: {
    id: string
    uuid: string
    type: string
    config: string
  }
}
