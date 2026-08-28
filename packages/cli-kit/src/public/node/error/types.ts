import type {
  JsonAbortErrorSchema,
  JsonBugErrorSchema,
  JsonErrorCustomSectionSchema,
  JsonErrorSchema,
  JsonExternalErrorSchema,
  jsonErrorOutputSchema,
} from './schema.js'
import type {z} from 'zod'

export type JsonErrorCustomSection = z.infer<typeof JsonErrorCustomSectionSchema>
export type JsonAbortError = z.infer<typeof JsonAbortErrorSchema>
export type JsonBugError = z.infer<typeof JsonBugErrorSchema>
export type JsonExternalError = z.infer<typeof JsonExternalErrorSchema>
export type JsonError = z.infer<typeof JsonErrorSchema>
export type JsonErrorType = JsonError['type']
export type JsonErrorDocument = z.infer<typeof jsonErrorOutputSchema.schema>
