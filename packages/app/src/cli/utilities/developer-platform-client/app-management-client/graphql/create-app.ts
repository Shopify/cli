import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const CreateAppMutation = gql`
  mutation CreateApp($appSource: AppSourceInput!, $name: String!) {
    appCreate(appSource: $appSource, name: $name) {
      app {
        id
        key
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
    appModules: {
      uid: string
      specificationIdentifier: string
      config: JsonMapType
    }[]
    assetsUrl?: string
  }
  name: string
}

export interface CreateAppMutationSchema {
  appCreate: {
    app: {
      id: string
      key: string
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
