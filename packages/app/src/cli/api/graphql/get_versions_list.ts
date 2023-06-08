import {gql} from 'graphql-request'

export const AppDeploymentsQuery = gql`
  query AppDeploymentsQuery($apiKey: String!) {
    app(apiKey: $apiKey) {
      id
      organizationId
      deployments(first: 10) {
        nodes {
          createdAt
          createdBy {
            displayName
          }
          label
          message
          status
          versionTag
        }
        pageInfo {
          totalResults
        }
      }
    }
  }
`

export interface AppDeploymentsQuerySchema {
  app: {
    id: string
    organizationId: string
    deployments: {
      nodes: {
        createdAt: string
        createdBy?: {
          displayName?: string
        }
        label: string
        message?: string
        status: string
        versionTag: string
      }[]
      pageInfo: {
        totalResults: number
      }
    }
  }
}
