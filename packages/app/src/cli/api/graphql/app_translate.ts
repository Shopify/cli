/* eslint-disable @shopify/cli/no-inline-graphql */
import {gql} from 'graphql-request'

// export const AppTranslate = gql`
//   mutation AppTranslate($apiKey: String!, $appVersionId: ID, $versionTag: String) {
//     appTranslate(input: {apiKey: $apiKey}) {
//       translationRequest {
//         id
//       }
//       userErrors {
//         message
//         field
//         category
//         details
//       }
//     }
//   }
// `

export const AppTranslate = gql`
  query AppTranslate($apiKey: String!) {
    app(apiKey: $apiKey) {
      id
      organizationId
      title
    }
  }
`

interface ErrorDetail {
  extension_id: number
  extension_title: string
}

export interface AppTranslateVariables {
  apiKey: string
}

export interface AppTranslateSchema {
  appTranslate: {
    translationRequest: {
      id?: string | null
    }
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
