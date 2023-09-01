import {gql} from 'graphql-request'

export const FindAppPreviewModeQuery = gql`
  query FindApp($apiKey: String!) {
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
