import {gql} from 'graphql-request'

export const FindAppPreviewModeQuery = gql`
  query FindAppPreviewMode($apiKey: String!) {
    app(apiKey: $apiKey) {
      developmentStorePreviewEnabled
    }
  }
`

export interface FindAppPreviewModeSchema {
  app: {
    developmentStorePreviewEnabled: boolean
  }
}

export interface FindAppPreviewModeVariables {
  apiKey: string
}
