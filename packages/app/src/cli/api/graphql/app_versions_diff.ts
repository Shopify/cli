import {gql} from 'graphql-request'

export const AppVersionsDiffQuery = gql`
  query AppVersionsDiff($apiKey: String!, $versionId: ID!) {
    app(apiKey: $apiKey) {
      versionsDiff(appVersionId: $versionId) {
        added {
          uuid
          registrationTitle
          specification {
            identifier
          }
        }
        updated {
          uuid
          registrationTitle
          specification {
            identifier
          }
        }
        removed {
          uuid
          registrationTitle
          specification {
            identifier
          }
        }
      }
    }
  }
`

export interface AppVersionsDiffExtensionSchema {
  uuid: string
  registrationTitle: string
  specification: {
    identifier: string
  }
}

export interface AppVersionsDiffSchema {
  app: {
    versionsDiff: {
      added: AppVersionsDiffExtensionSchema[]
      updated: AppVersionsDiffExtensionSchema[]
      removed: AppVersionsDiffExtensionSchema[]
    }
  }
}
