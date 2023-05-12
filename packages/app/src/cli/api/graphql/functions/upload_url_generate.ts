import {gql} from 'graphql-request'

export const UploadUrlGenerateMutation = gql`
  mutation uploadUrlGenerate {
    uploadUrlGenerate {
      url
      moduleId
      headers
      maxSize
    }
  }
`

export interface UploadUrlGenerateMutationSchema {
  data: {
    uploadUrlGenerate: {
      url: string
      moduleId: string
      headers: {[key: string]: string}
      maxSize: string
    }
  }
}
