import {ExtensionFlavorValue} from '../../services/generate/extension.js'
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

interface ExtensionType {
  url: string
  type: string
  extensionPoints: string[]
  supportedFlavors: {
    name: string
    value: ExtensionFlavorValue
    path: string
  }[]
}

export interface RemoteTemplateSpecificationsSchema {
  templateSpecifications: {
    identifier: string
    name: string
    defaultName: string
    group: string
    sortPriority: number
    supportLinks: string[]
    types: [ExtensionType, ...ExtensionType[]]
  }[]
}

export interface RemoteTemplateSpecificationsVariables {
  apiKey: string
}
