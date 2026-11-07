import {defineJsonOutputSchema} from '../json-output-schema.js'
import {zod} from '../schema.js'

export const JsonErrorCustomSectionSchema = zod
  .object({
    title: zod.string().optional(),
    body: zod.union([zod.string(), zod.array(zod.array(zod.string()))]),
  })
  .strict()

const commonJsonErrorShape = {
  message: zod.string(),
  code: zod.string().min(1).optional().describe('A stable error code, included only when known.'),
  tryMessage: zod.string().optional(),
  nextSteps: zod.array(zod.string()).optional(),
  customSections: zod.array(JsonErrorCustomSectionSchema).optional(),
  details: zod
    .unknown()
    .optional()
    .describe('Selected domain details, preserving native API payloads such as GraphQL errors, extensions, and data.'),
}

export const JsonAbortErrorSchema = zod
  .object({
    type: zod.literal('abort'),
    ...commonJsonErrorShape,
  })
  .strict()

export const JsonBugErrorSchema = zod
  .object({
    type: zod.literal('bug'),
    ...commonJsonErrorShape,
    stack: zod.string().optional(),
  })
  .strict()

export const JsonExternalErrorSchema = zod
  .object({
    type: zod.literal('external'),
    ...commonJsonErrorShape,
    command: zod.string(),
    args: zod.array(zod.string()),
  })
  .strict()

export const JsonErrorSchema = zod.union([JsonAbortErrorSchema, JsonBugErrorSchema, JsonExternalErrorSchema])

const JsonErrorDocumentSchema = zod.object({error: JsonErrorSchema}).strict()

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
