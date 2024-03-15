import {AppModuleVersion} from './app_active_version.js'
import {gql} from 'graphql-request'

export const AppVersionByTagQuery = gql`
  query AppVersionByTag($apiKey: String!, $versionTag: String!) {
    app(apiKey: $apiKey) {
      appVersion(versionTag: $versionTag) {
        id
        uuid
        versionTag
        location
        message
        appModuleVersions {
          config
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

export interface AppVersionByTagVariables {
  apiKey: string
  versionTag?: string
}

export interface AppVersionByTagSchema {
  app: {
    appVersion: {
      id: number
      uuid: string
      versionTag: string
      location: string
      message: string
      appModuleVersions: AppModuleVersion[]
    }
  }
}
