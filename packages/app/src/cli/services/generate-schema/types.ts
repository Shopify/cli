import {functionAbsolutePathSchema} from '../function/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const schemaFileSchema = zod
  .object({
    path: functionAbsolutePathSchema,
    format: zod.literal('graphql').describe('The file contains native GraphQL SDL with the API-version header.'),
  })
  .strict()
const schemaContentSchema = zod
  .object({
    schema: zod.string().describe('Native GraphQL SDL with the API-version header, returned with --stdout --json.'),
  })
  .strict()

export const functionSchemaJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionSchemaResult',
  schema: zod.union([schemaFileSchema, schemaContentSchema]),
  definitions: {FunctionSchemaFile: schemaFileSchema, FunctionSchemaContent: schemaContentSchema},
})

export type FunctionSchemaResult = InferJsonOutputSchema<typeof functionSchemaJsonOutputSchema>

export interface GeneratedFunctionSchema {
  definition: string
  path: string
  localIdentifier: string
}
