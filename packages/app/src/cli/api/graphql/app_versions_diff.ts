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
            experience
            options {
              managementExperience
            }
          }
        }
        updated {
          uuid
          registrationTitle
          specification {
            identifier
            experience
            options {
              managementExperience
            }
          }
        }
        removed {
          uuid
          registrationTitle
          specification {
            identifier
            experience
            options {
              managementExperience
            }
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
    experience: string
    options: {
      managementExperience: string
    }
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

export interface AppVersionsDiffVariables {
  apiKey: string
  versionId?: number
}
