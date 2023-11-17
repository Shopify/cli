import {gql} from 'graphql-request'

export const DevSessionUpdateMutation = gql`
  mutation devSessionUpdate($bundleUrl: String, $appModules: [AppModuleSettings!]) {
    devSessionUpdate(bundleUrl: $bundleUrl, appModules: $appModules) {
      appPackageUuids
      userErrors {
        field
        message
      }
    }
  }
`

export interface DevSessionUpdateVariables {
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
