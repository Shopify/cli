import {gql} from 'graphql-request'

export const DevSessionGenerateUrlMutation = gql`
  mutation DevSessionSignedUrlGenerate($apiKey: String!) {
    devSessionSignedUrlGenerate(apiKey: $apiKey) {
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
  devSessionSignedUrlGenerate: {
    signedUrl: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
