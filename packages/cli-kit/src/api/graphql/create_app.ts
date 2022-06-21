import {gql} from 'graphql-request'

export const CreateAppQuery = gql`
  mutation AppCreate($org: Int!, $title: String!, $appUrl: Url!, $redir: [Url]!, $type: AppType) {
    appCreate(
      input: {
        organizationID: $org
        title: $title
        applicationUrl: $appUrl
        redirectUrlWhitelist: $redir
        appType: $type
      }
    ) {
      app {
        id
        apiKey
        title
        appType
        applicationUrl
        redirectUrlWhitelist
        organizationId
        apiSecretKeys {
          secret
        }
        appType
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
}

export interface CreateAppQuerySchema {
  appCreate: {
    app: {
      id: string
      apiKey: string
      title: string
      applicationUrl: string
      redirectUrlWhitelist: string[]
      organizationId: string
      apiSecretKeys: {
        secret: string
      }[]
      appType: string
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
