import {gql} from 'graphql-request'

export const GenerateSignedUploadUrl = gql`
  mutation GenerateSignedUploadUrl($apiKey: String!, $bundleFormat: Int!) {
    appVersionGenerateSignedUploadUrl(input: {apiKey: $apiKey, bundleFormat: $bundleFormat}) {
      signedUploadUrl
      userErrors {
        field
        message
      }
    }
  }
`

export interface GenerateSignedUploadUrlVariables {
  apiKey: string
  bundleFormat: number
}

export interface GenerateSignedUploadUrlSchema {
  appVersionGenerateSignedUploadUrl: {
    signedUploadUrl: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
