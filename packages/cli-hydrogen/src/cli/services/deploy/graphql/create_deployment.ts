import {DMSError} from '../types.js'
import {gql} from 'graphql-request'

export const CreateDeploymentQuery = gql`
  mutation createDeployment($input: CreateDeploymentInput!) {
    createDeployment(input: $input) {
      deploymentID
      assetBaseURL
      error {
        code
        unrecoverable
        debugInfo
      }
    }
  }
`

export interface CreateDeploymentQuerySchema {
  createDeployment: CreateDeploymentResponse
}

export interface CreateDeploymentResponse {
  deploymentID: string
  assetBaseURL: string
  error: DMSError
}
