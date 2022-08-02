import {gql} from 'graphql-request'

export const AppFunctionSetMutation = gql`
  mutation FunctionSet(
    $id: FunctionId
    $legacyUuid: String
    $title: String!
    $description: String
    $apiType: String!
    $apiVersion: String!
    $inputQuery: String
    $appBridge: AppBridgeInput
    $moduleUploadUrl: String!
  ) {
    functionSet(
      id: $id
      legacyUuid: $legacyUuid
      title: $title
      description: $description
      apiType: $apiType
      apiVersion: $apiVersion
      inputQuery: $inputQuery
      appBridge: $appBridge
      moduleUploadUrl: $moduleUploadUrl
    ) {
      userErrors {
        field
        message
        tag
      }
      function {
        id
        uuid
        appKey
        configuration {
          schema
        }
        apiType
        title
      }
    }
  }
`

export interface AppFunctionSetMutationSchema {
  data: {
    functionSet: {
      userErrors: {
        field: string
        message: string
        tag: string
      }[]
      function?: {
        id: string
      }
    }
  }
}

export interface AppFunctionSetVariables {
  id?: string
  legacyUuid?: string
  title: string
  description?: string
  apiType: string
  apiVersion?: string
  inputQuery?: string
  appBridge?: {
    createPath?: string
    detailsPath?: string
  }
  moduleUploadUrl: string
}
