import {gql} from 'graphql-request'

export const CreateAppQuery = gql`
  mutation AppCreate(
    $org: Int!
    $title: String!
    $appUrl: Url!
    $redir: [Url]!
    $type: AppType
    $requestedAccessScopes: [String!]
  ) {
    appCreate(
      input: {
        organizationID: $org
        title: $title
        applicationUrl: $appUrl
        redirectUrlWhitelist: $redir
        appType: $type
        requestedAccessScopes: $requestedAccessScopes
      }
    ) {
      app {
        id
        title
        apiKey
        organizationId
        apiSecretKeys {
          secret
        }
        appType
        grantedScopes
        disabledBetas
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAppQueryVariables {
  org: number
  title: string
  appUrl: string
  redir: string[]
  type: string
  requestedAccessScopes?: string[]
}

export interface CreateAppQuerySchema {
  appCreate: {
    app: {
      id: string
      title: string
      apiKey: string
      organizationId: string
      apiSecretKeys: {
        secret: string
      }[]
      appType: string
      grantedScopes: string[]
      disabledBetas: string[]
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
