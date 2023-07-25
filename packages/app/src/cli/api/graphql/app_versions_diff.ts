import {gql} from 'graphql-request'

export const AppVersionsDiffQuery = gql`
  query AppVersionsDiff($apiKey: String!, $versionId: ID!) {
    app(apiKey: $apiKey) {
      versionsDiff(appVersionId: $versionId) {
        added {
          uuid
          registrationTitle
        }
        updated {
          uuid
          registrationTitle
        }
        removed {
          uuid
          registrationTitle
        }
      }
    }
  }
`

export interface AppVersionsDiffSchema {
  app: {
    versionsDiff: {
      added: {
        uuid: string
        registrationTitle: string
      }[]
      updated: {
        uuid: string
        registrationTitle: string
      }[]
      removed: {
        uuid: string
        registrationTitle: string
      }[]
    }
  }
}
