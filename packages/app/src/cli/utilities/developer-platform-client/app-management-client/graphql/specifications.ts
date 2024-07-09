import {gql} from 'graphql-request'

export const SpecificationsQuery = gql`
  query fetchSpecifications {
    specifications {
      name
      identifier
      externalIdentifier
      features
      uidStrategy {
        appModuleLimit
      }
    }
  }
`

interface RemoteSpecification {
  name: string
  identifier: string
  externalIdentifier: string
  features?: string[]
  uidStrategy: {
    appModuleLimit: number
  }
}

export interface SpecificationsQuerySchema {
  specifications: RemoteSpecification[]
}
