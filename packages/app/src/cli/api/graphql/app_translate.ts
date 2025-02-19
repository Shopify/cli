import {gql} from 'graphql-request'

export const AppTranslate = gql`
  mutation AppTranslate($apiKey: String!, $appVersionId: ID, $versionTag: String) {
    appTranslate(input: {apiKey: $apiKey}) {
      translationRequest {
        id
      }
      userErrors {
        message
        field
        category
        details
      }
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
