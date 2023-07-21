import {gql} from 'graphql-request'

export const GenerateSignedUploadUrl = gql`
  mutation GenerateSignedUploadUrl($apiKey: String!, $appVersionUuid: String!, $bundleFormat: Int!) {
    deploymentGenerateSignedUploadUrl(
      input: {apiKey: $apiKey, appVersionUuid: $appVersionUuid, bundleFormat: $bundleFormat}
    ) {
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
  appVersionUuid: string
  bundleFormat: number
}

export interface GenerateSignedUploadUrlSchema {
  deploymentGenerateSignedUploadUrl: {
    signedUploadUrl: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
