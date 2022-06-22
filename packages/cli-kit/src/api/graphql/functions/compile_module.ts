import {gql} from 'graphql-request'

export const CompileModuleMutation = gql`
  mutation compileModule($moduleUploadUrl: String!) {
    compileModule(moduleUploadUrl: $moduleUploadUrl) {
      jobId
      userErrors {
        field
        message
      }
    }
  }
`

export interface CompileModuleMutationSchema {
  data: {
    compileModule: {
      jobId: string
      userErrors: {
        field: string
        message: string
      }[]
    }
  }
}

export interface CompileModuleMutationVariables {
  moduleUploadUrl: string
}
