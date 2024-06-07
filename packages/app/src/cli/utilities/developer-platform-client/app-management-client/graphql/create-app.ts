import {gql} from 'graphql-request'

export const CreateAppMutation = gql`
  mutation CreateApp($appModules: [NewModuleVersion!]!) {
    appCreate(appModules: $appModules) {
      app {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAppMutationVariables {
  appModules: {
    uid: string
    specificationIdentifier: string
    config: string
  }[]
  assetsUrl?: string
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
