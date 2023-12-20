import {gql} from 'graphql-request'

export const ActiveAppVersionQuery = gql`
  query activeAppVersion($apiKey: String!) {
    app(apiKey: $apiKey) {
      activeAppVersion {
        appModuleVersions {
          registrationId
          registrationUuid
          registrationTitle
          type
          specification {
            identifier
            name
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

export interface ActiveAppVersionQueryVariables {
  apiKey: string
}

interface AppModuleVersionSpecification {
  identifier: string
  name: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
  }
}

interface AppModuleVersion {
  registrationId: string
  registrationUuid: string
  registrationTitle: string
  type: string
  specification?: AppModuleVersionSpecification
}

export interface ActiveAppVersionQuerySchema {
  app: {
    activeAppVersion: {
      appModuleVersions: AppModuleVersion[]
    }
  }
}
