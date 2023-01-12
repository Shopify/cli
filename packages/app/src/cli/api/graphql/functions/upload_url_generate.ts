import {gql} from 'graphql-request'

export const UploadUrlGenerateMutation = gql`
  mutation uploadUrlGenerate {
    uploadUrlGenerate {
      url
      headers
      maxSize
    }
  }
`

export interface UploadUrlGenerateMutationSchema {
  data: {
    uploadUrlGenerate: {
      url: string
      headers: {[key: string]: string}
      maxSize: string
    }
  }
}
