import {defineJsonOutputSchema} from '../json-output-schema.js'
import {zod} from '../schema.js'
import type {
  JsonAbortError,
  JsonBugError,
  JsonError,
  JsonErrorCustomSection,
  JsonErrorDocument,
  JsonExternalError,
} from './types.js'
import type {ZodType} from 'zod'

export const JsonErrorCustomSectionSchema = zod
  .object({
    title: zod.string().optional(),
    body: zod.union([zod.string(), zod.array(zod.array(zod.string()))]),
  })
  .strict() satisfies ZodType<JsonErrorCustomSection>

const commonJsonErrorShape = {
  message: zod.string(),
  tryMessage: zod.string().optional(),
  nextSteps: zod.array(zod.string()).optional(),
  customSections: zod.array(JsonErrorCustomSectionSchema).optional(),
}

export const JsonAbortErrorSchema = zod
  .object({
    type: zod.literal('abort'),
    ...commonJsonErrorShape,
  })
  .strict() satisfies ZodType<JsonAbortError>

export const JsonBugErrorSchema = zod
  .object({
    type: zod.literal('bug'),
    ...commonJsonErrorShape,
    stack: zod.string().optional(),
  })
  .strict() satisfies ZodType<JsonBugError>

export const JsonExternalErrorSchema = zod
  .object({
    type: zod.literal('external'),
    ...commonJsonErrorShape,
    command: zod.string(),
    args: zod.array(zod.string()),
  })
  .strict() satisfies ZodType<JsonExternalError>

export const JsonErrorSchema = zod.union([
  JsonAbortErrorSchema,
  JsonBugErrorSchema,
  JsonExternalErrorSchema,
]) satisfies ZodType<JsonError>

const JsonErrorDocumentSchema = zod.object({error: JsonErrorSchema}).strict() satisfies ZodType<JsonErrorDocument>

export const jsonErrorOutputSchema = defineJsonOutputSchema({
  name: 'JsonErrorDocument',
  schema: JsonErrorDocumentSchema,
  definitions: {
    JsonError: JsonErrorSchema,
    JsonErrorCustomSection: JsonErrorCustomSectionSchema,
    JsonAbortError: JsonAbortErrorSchema,
    JsonBugError: JsonBugErrorSchema,
    JsonExternalError: JsonExternalErrorSchema,
  },
})
