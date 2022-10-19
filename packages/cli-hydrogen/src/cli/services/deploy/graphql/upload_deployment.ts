import {gql} from 'graphql-request'

export const UploadDeploymentQuery = gql`
  mutation uploadDeployment($file: Upload!, $deploymentID: ID!) {
    uploadDeployment(file: $file, deploymentID: $deploymentID) {
      deployment {
        previewURL
      }
      error {
        code
        unrecoverable
        debugInfo
      }
    }
  }
`
