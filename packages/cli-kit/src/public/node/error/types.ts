export type JsonErrorType = 'abort' | 'bug' | 'external'

export interface JsonErrorCustomSection {
  title?: string
  body: string | string[][]
}

interface JsonErrorBase {
  message: string
  tryMessage?: string
  nextSteps?: string[]
  customSections?: JsonErrorCustomSection[]
}

export interface JsonAbortError extends JsonErrorBase {
  type: 'abort'
}

export interface JsonBugError extends JsonErrorBase {
  type: 'bug'
  stack?: string
}

export interface JsonExternalError extends JsonErrorBase {
  type: 'external'
  command: string
  args: string[]
}

export type JsonError = JsonAbortError | JsonBugError | JsonExternalError

export interface JsonErrorDocument {
  error: JsonError
}
