import {gql} from 'graphql-request'

export const DevSessionCreate = gql`
  mutation DevSessionDeploy($appId: String!, $assetsUrl: String!) {
    devSessionCreate(appId: $appId, assetsUrl: $assetsUrl) {
      userErrors {
        message
      }
    }
  }
`

interface ErrorDetail {
  extension_id: number
  extension_title: string
}

export interface DevSessionCreateVariables {
  appId: string
  assetsUrl: string
}

export interface DevSessionCreateSchema {
  devSessionCreate: {
    userErrors: {
      field: string[]
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
