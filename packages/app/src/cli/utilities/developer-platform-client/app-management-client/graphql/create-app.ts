import {gql} from 'graphql-request'

export const CreateAppMutation = gql`
  mutation CreateApp($appSource: AppSourceInput!, $name: String!) {
    appCreate(appSource: $appSource, name: $name) {
      app {
        id
      }
      userErrors {
        category
        message
        on
      }
    }
  }
`

export interface CreateAppMutationVariables {
  appSource: {
    modules: {
      uid: string
      specificationIdentifier: string
      config: string
    }[]
    assetsUrl?: string
  }
  name: string
}

export interface CreateAppMutationSchema {
  appCreate: {
    app: {
      id: string
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
