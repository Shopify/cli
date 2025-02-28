/* eslint-disable @shopify/cli/no-inline-graphql */
import {gql} from 'graphql-request'

export const CreateTranslationRequest = gql`
  mutation CreateTranslationRequest(
    $sourceLanguage: String!
    $targetLanguage: String!
    $sourceTexts: [TranslationText!]!
    $nonTranslatableTerms: [String!]!
    $promptContext: String
  ) {
    createTranslationRequest(
      sourceLanguage: $sourceLanguage
      targetLanguage: $targetLanguage
      sourceTexts: $sourceTexts
      nonTranslatableTerms: $nonTranslatableTerms
      promptContext: $promptContext
    ) {
      id
      fulfilled
      sourceTexts {
        targetLanguage
        key
        value
      }
      targetTexts {
        targetLanguage
        key
        value
      }
    }
  }
`

export const GetTranslationRequest = gql`
  query GetTranslationRequest($id: String!) {
    translationRequest(id: $id) {
      id
      fulfilled
      sourceTexts {
        targetLanguage
        key
        value
      }
      targetTexts {
        targetLanguage
        key
        value
      }
    }
  }
`

export interface TranslationText {
  targetLanguage: string
  key: string
  value: string
}

export interface TranslationRequest {
  id: string
  fulfilled: boolean
  sourceTexts: TranslationText[]
  targetTexts?: TranslationText[]
}

export interface CreateTranslationRequestSchema {
  createTranslationRequest: TranslationRequest
  userErrors: {
    field?: string[] | null
    message: string
  }[]
}

export interface CreateTranslationRequestInput {
  sourceLanguage: string
  targetLanguage: string
  sourceTexts: TranslationText[]
  nonTranslatableTerms: string[]
  promptContext?: string
}

export interface GetTranslationRequestSchema {
  getTranslationRequest: {
    translationRequest: TranslationRequest
  }
}
