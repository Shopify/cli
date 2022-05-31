import {gql} from 'graphql-request'

export const ModuleUploadUrlGenerateMutation = gql`
  mutation moduleUploadUrlGenerate {
    moduleUploadUrlGenerate {
      details {
        url
        headers
        humanizedMaxSize
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface ModuleUploadUrlGenerateMutationSchema {
  data: {
    moduleUploadUrlGenerate: {
      details: {
        url: string
        headers: unknown
        humanizedMaxSize: string
      }
      userErrors: {
        field: string
        message: string
      }[]
    }
  }
}
