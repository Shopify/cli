import {gql} from 'graphql-request'

export const DevSessionGenerateUrlMutation = gql`
  mutation generateDevSessionSignedUrl($apiKey: String!) {
    generateDevSessionSignedUrl(apiKey: $apiKey) {
      signedUrl
      userErrors {
        field
        message
      }
    }
  }
`

export interface DevSessionGenerateUrlVariables {
  apiKey: string
}

export interface DevSessionGenerateUrlSchema {
  generateDevSessionSignedUrl: {
    signedUrl: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
