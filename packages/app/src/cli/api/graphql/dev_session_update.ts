import {gql} from 'graphql-request'

export const DevSessionUpdateMutation = gql`
  mutation devSessionUpdate(
    $apiKey: String!
    $bundleUrl: String
    $appModules: [AppModuleSettings!]
    $devSessionUpdateType: DevSessionUpdateType
  ) {
    devSessionUpdate(
      apiKey: $apiKey
      bundleUrl: $bundleUrl
      appModules: $appModules
      devSessionUpdateType: $devSessionUpdateType
    ) {
      success
      userErrors {
        field
        message
      }
    }
  }
`

export interface DevSessionUpdateVariables {
  devSessionUpdateType: 'ABSOLUTE' | 'UPDATE_ONLY' | 'DELETE_ONLY'
  bundleUrl: string
  apiKey: string
  appModules: {
    uuid: string
    config: string
    context: string
    specificationIdentifier: string
  }[]
}

export interface DevSessionUpdateSchema {
  devSessionUpdate: {
    success: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
