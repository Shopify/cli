import {gql} from 'graphql-request'

export const DevSessionDeploy = gql`
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

export interface DevSessionDeployVariables {
  appId: string
  assetsUrl: string
}

export interface DevSessionDeploySchema {
  devSession: {
    userErrors: {
      field: string[]
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
