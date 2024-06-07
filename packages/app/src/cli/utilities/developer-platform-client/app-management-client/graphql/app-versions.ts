import {gql} from 'graphql-request'

export const AppVersionsQuery = gql`
  query AppVersions($appId: ID!) {
    app(id: $appId) {
      id
      versions {
        id
        versionTag
        createdBy {
          name
        }
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
    versions: {
      id: string
      createdBy: {
        name: string
      }
      versionTag: string
    }[]
  }
}
