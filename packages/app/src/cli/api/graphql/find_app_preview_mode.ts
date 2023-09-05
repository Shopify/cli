import {gql} from 'graphql-request'

export const FindAppPreviewModeQuery = gql`
  query FindAppPreviewMode($apiKey: String!) {
    app(apiKey: $apiKey) {
      developmentStorePreviewEnabled
    }
  }
`

export interface FindAppPreviewModeQuerySchema {
  app: {
    developmentStorePreviewEnabled: boolean
  }
}
