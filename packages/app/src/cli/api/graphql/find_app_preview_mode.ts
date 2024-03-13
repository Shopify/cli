import {gql} from 'graphql-request'

export const FindAppPreviewModeQuery = gql`
  query FindAppPreviewMode($apiKey: String!) {
    app(apiKey: $apiKey) {
      developmentStorePreviewEnabled
    }
  }
`

export const FindAppFunctionLogs = gql`
  query FindAppFunctionLogs {
    appEvents
  }
`

export interface FindAppPreviewModeQuerySchema {
  app: {
    developmentStorePreviewEnabled: boolean
  }
}

export interface FindAppFunctionLogsQuerySchema {
  appEvents: [string]
}
