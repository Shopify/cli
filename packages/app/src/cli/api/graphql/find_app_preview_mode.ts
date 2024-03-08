import {gql} from 'graphql-request'

export const FindAppPreviewModeQuery = gql`
  query FindAppPreviewMode($apiKey: String!) {
    app(apiKey: $apiKey) {
      developmentStorePreviewEnabled
    }
  }
`

export const FindAppFunctionLogs = gql`
  query FindAppFunctionLogs($functionId: String!) {
    app {
      functionLogs(functionId: $functionId) {
        logs
        type
        input
        inputBytes
        output
        outputBytes
        functionId
        fuelConsumer
        errorMessage
        errorType
      }
    }
  }
`

export interface FindAppPreviewModeQuerySchema {
  app: {
    developmentStorePreviewEnabled: boolean
  }
}

export interface FindAppFunctionLogsQuerySchema {
  app: {
    functionLogs: {
      logs: string
      type: string
      input: string
      inputBytes: string
      output: string
      outputBytes: string
      functionId: string
      fuelConsumer: string
      errorMessage: string
      errorType: string
    }
  }
}
