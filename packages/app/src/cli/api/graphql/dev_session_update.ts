import {gql} from 'graphql-request'

export const DevSessionUpdateMutation = gql`
  mutation devSessionUpdate($apiKey: String!, $bundleUrl: String, $appModules: [AppModuleSettings!]) {
    devSessionUpdate(apiKey: $apiKey, bundleUrl: $bundleUrl, appModules: $appModules) {
      appPackageUuids
      userErrors {
        field
        message
      }
    }
  }
`

export interface DevSessionUpdateVariables {
  apiKey: string
  bundleUrl: string
  appModules: {
    uuid: string
    config: string
    context: string
    specificationIdentifier: string
  }[]
}

export interface DevSessionUpdateSchema {
  devSessionUpdate: {
    appPackageUuids: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
