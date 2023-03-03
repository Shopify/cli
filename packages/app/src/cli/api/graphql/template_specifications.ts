import {ExtensionFlavor} from '../../models/app/extensions.js'
import {gql} from 'graphql-request'

export const TemplateSpecificationsQuery = gql`
  query {
    templateSpecifications {
      identifier
      name
      category
      supportLinks
      url
      types {
        type
        extensionPoints
        supportedFlavors {
          type
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

export interface TemplateSpecification {
  identifier: string
  name: string
  category: string
  supportLinks: string[]
  url: string
  types: TemplateType[]
}

export interface TemplateSpecificationsQuerySchema {
  templateSpecifications: TemplateSpecification[]
}
