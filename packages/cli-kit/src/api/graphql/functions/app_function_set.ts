import {gql} from 'graphql-request'

export const AppFunctionSetMutation = gql`
  mutation AppScriptSet(
    $uuid: String
    $extensionPointName: ExtensionPointName!
    $title: String!
    $description: String
    $force: Boolean
    $schemaMajorVersion: String
    $schemaMinorVersion: String
    $scriptConfigVersion: String
    $configurationUi: Boolean!
    $configurationDefinition: String
    $moduleUploadUrl: String!
    $library: LibraryInput
    $inputQuery: String
    $appBridge: AppBridgeInput
    $apiVersion: String
  ) {
    appScriptSet(
      uuid: $uuid
      extensionPointName: $extensionPointName
      title: $title
      description: $description
      force: $force
      schemaMajorVersion: $schemaMajorVersion
      schemaMinorVersion: $schemaMinorVersion
      scriptConfigVersion: $scriptConfigVersion
      configurationUi: $configurationUi
      configurationDefinition: $configurationDefinition
      moduleUploadUrl: $moduleUploadUrl
      library: $library
      inputQuery: $inputQuery
      appBridge: $appBridge
      apiVersion: $apiVersion
    ) {
      userErrors {
        field
        message
        tag
      }
      appScript {
        uuid
        appKey
        configSchema
        extensionPointName
        title
      }
    }
  }
`

export interface AppFunctionSetMutationSchema {
  data: {
    appScriptSet: {
      userErrors: {
        field: string
        message: string
        tag: string
      }[]
      appScript?: {
        uuid: string
        appKey: string
        configSchema: unknown
        extensionPointName: string
        title: string
      }
    }
  }
}

export interface AppFunctionSetVariables {
  uuid?: string
  extensionPointName: string
  title: string
  description?: string
  force?: boolean
  schemaMajorVersion?: string
  schemaMinorVersion?: string
  scriptConfigVersion?: string
  configurationUi: boolean
  configurationDefinition?: string
  moduleUploadUrl: string
  library?: {
    language: string
    version: string
  }
  appBridge?: {
    createPath?: string
    detailsPath?: string
  }
  inputQuery?: string
  apiVersion?: string
  skipCompilationJob: boolean
}
