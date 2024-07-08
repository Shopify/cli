import {gql} from 'graphql-request'

export const AppVersionsQuery = gql`
  query AppVersions($appId: ID!) {
    app(id: $appId) {
      id
      activeRelease {
        id
        version {
          id
        }
      }
    }
    versions(appId: $appId) {
      id
      createdAt
      createdBy
      metadata {
        message
        versionTag
      }
    }
  }
`

export interface AppVersionsQueryVariables {
  appId: string
}

export interface AppVersionsQuerySchema {
  app: {
    id: string
    activeRelease: {
      id: string
      version: {
        id: string
      }
    }
  }
  versions: {
    id: string
    createdAt: string
    createdBy: string
    metadata: {
      message: string
      versionTag: string
    }
  }[]
}
