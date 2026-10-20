import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const absolutePathSchema = zod
  .string()
  .regex(/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/)
  .describe('An absolute native filesystem path.')

const functionTargetSchema = zod
  .object({
    target: zod.string().min(1),
    inputQueryPath: absolutePathSchema.nullable().describe('Null when no input query is configured.'),
    export: zod.string().min(1).nullable().describe('Null when no WebAssembly export is configured.'),
  })
  .strict()

const functionInfoSchema = zod
  .object({
    handle: zod.string().nullable().describe('Null when the extension does not configure a handle.'),
    name: zod.string(),
    apiVersion: zod.string().nullable().describe('The configured API version, or null when unavailable.'),
    directory: absolutePathSchema,
    targets: zod.array(functionTargetSchema).describe('All configured targets; empty when none are configured.'),
    schemaPath: absolutePathSchema.nullable().describe('Null when a GraphQL schema is unavailable.'),
    wasmPath: absolutePathSchema,
    functionRunnerPath: absolutePathSchema,
  })
  .strict()

export const functionInfoJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionInfoResult',
  schema: zod.object({function: functionInfoSchema}).strict(),
  definitions: {FunctionInfo: functionInfoSchema, FunctionTarget: functionTargetSchema},
})

export type FunctionInfoResult = InferJsonOutputSchema<typeof functionInfoJsonOutputSchema>
