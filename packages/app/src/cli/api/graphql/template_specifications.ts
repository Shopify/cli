import {ExtensionTemplate} from '../../models/app/template.js'
import {gql} from 'graphql-request'

export const RemoteTemplateSpecificationsQuery = gql`
  query RemoteTemplateSpecifications($version: String, $apiKey: String) {
    templateSpecifications(version: $version, apiKey: $apiKey) {
      identifier
      name
      defaultName
      group
      sortPriority
      supportLinks
      types {
        url
        type
        extensionPoints
        supportedFlavors {
          name
          value
          path
        }
      }
    }
  }
`

export interface RemoteTemplateSpecificationsSchema {
  templateSpecifications: ExtensionTemplate[]
}

export interface RemoteTemplateSpecificationsVariables {
  apiKey: string
}
