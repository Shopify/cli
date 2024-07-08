import {gql} from 'graphql-request'

export const DevSessionUpdate = gql`
  mutation DevSessionUpdate($appId: String!, $assetsUrl: String!) {
    devSessionUpdate(appId: $appId, assetsUrl: $assetsUrl) {
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

export interface DevSessionUpdateVariables {
  appId: string
  assetsUrl: string
}

export interface DevSessionUpdateSchema {
  devSessionUpdate: {
    userErrors: {
      field: string[]
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
