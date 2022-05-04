import {gql} from 'graphql-request'

export const GenerateSignedUploadUrl = gql`
  mutation GenerateSignedUploadUrl($apiKey: String!, $deploymentUuid: String!, $bundleFormat: Int!) {
    deploymentGenerateSignedUploadUrl(
      input: {apiKey: $apiKey, deploymentUuid: $deploymentUuid, bundleFormat: $bundleFormat}
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
  deploymentUuid: string
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
