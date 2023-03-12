import {ExtensionFlavor} from '../../models/app/extensions.js'
import {gql} from 'graphql-request'

export const RemoteTemplateSpecificationsQuery = gql`
  query {
    templateSpecifications {
      identifier
      name
      group
      supportLinks
      url
      types {
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

export interface TemplateType {
  type: string
  extensionPoints: string[]
  supportedFlavors: ExtensionFlavor[]
}

export interface RemoteTemplateSpecification {
  identifier: string
  name: string
  group: string
  supportLinks: string[]
  url: string
  types: TemplateType[]
}

export interface RemoteTemplateSpecificationsQuerySchema {
  templateSpecifications: RemoteTemplateSpecification[]
}
