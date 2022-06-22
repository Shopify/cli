import {gql} from 'graphql-request'

export const ModuleCompilationStatusQuery = gql`
  query moduleCompilationStatus($jobId: String!) {
    moduleCompilationStatus(jobId: $jobId) {
      status
      userErrors {
        field
        message
      }
    }
  }
`

export interface ModuleCompilationStatusQuerySchema {
  data: {
    moduleCompilationStatus: {
      status: string
      userErrors: {
        field: string
        message: string
      }[]
    }
  }
}

export interface ModuleCompilationQueryVariables {
  jobId: string
}
