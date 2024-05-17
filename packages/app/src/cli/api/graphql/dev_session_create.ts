import {gql} from 'graphql-request'

export const DevSessionDeploy = gql`
  mutation DevSessionDeploy($appId: String!, $url: String!) {
    devSessionCreate(input: {appId: $appId, url: $url}) {
      userErrors {
        message
        field
        category
        details
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
  url: string
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
