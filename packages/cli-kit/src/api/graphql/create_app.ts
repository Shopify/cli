import {gql} from 'graphql-request'

export const CreateAppQuery = gql`
  mutation AppCreate($org: Int!, $title: String!, $app_url: Url!, $redir: [Url]!, $type: AppType) {
    appCreate(
      input: {
        organizationID: $org
        title: $title
        applicationUrl: $app_url
        redirectUrlWhitelist: $redir
        appType: $type
      }
    ) {
      app {
        id
        apiKey
        title
        applicationUrl
        redirectUrlWhitelist
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

export interface CreateAppQuery {
  app: {
    id: string
    apiKey: string
    title: string
    applicationUrl: string
    redirectUrlWhitelist: string[]
    apiSecretKeys: {
      secret: string
    }
    appType: string
  }
  userErrors: {
    field: string
    message: string
  }
}
