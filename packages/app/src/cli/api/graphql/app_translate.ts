/* eslint-disable @shopify/cli/no-inline-graphql */
import {gql} from 'graphql-request'

export const CreateTranslationRequest = gql`
  mutation CreateTranslationRequest(
    $sourceLanguage: String!
    $targetLanguage: String!
    $sourceTexts: [TranslationStringInput!]!
    $nonTranslatableTerms: [String!]!
    $promptContext: String
  ) {
    translationRequestCreate(
      input: {
        sourceLanguage: $sourceLanguage
        targetLanguage: $targetLanguage
        sourceTexts: $sourceTexts
        nonTranslatableTerms: $nonTranslatableTerms
        promptContext: $promptContext
      }
    ) {
      throttleStatus
      translationRequest {
        id
        fulfilled
        targetLanguage
        targetTexts {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const GetTranslationRequest = gql`
  query GetTranslationRequest($requestId: String!) {
    translationRequest(id: $requestId) {
      id
      fulfilled
      targetLanguage
      targetTexts {
        key
        value
      }
    }
  }
`

export interface TranslationText {
  key: string
  value: string
}

export interface TranslationRequest {
  id: string
  fulfilled: boolean
  targetTexts?: TranslationText[] | null
}

export interface CreateTranslationRequestSchema {
  translationRequestCreate: {
    translationRequest: TranslationRequest
    userErrors: {
      field?: string[] | null
      message: string
    }[]
  }
}

export interface CreateTranslationRequestInput {
  sourceLanguage: string
  targetLanguage: string
  sourceTexts: TranslationText[]
  nonTranslatableTerms: string[]
  promptContext?: string
}

export interface GetTranslationRequestSchema {
  translationRequest: TranslationRequest
}
