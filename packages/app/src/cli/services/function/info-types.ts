import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const FunctionTargetingSchema = zod.object({
  inputQueryPath: zod.string().optional(),
  export: zod.string().optional(),
})

const FunctionInfoResultSchema = zod.object({
  handle: zod.string().optional(),
  name: zod.string(),
  apiVersion: zod.string().optional(),
  targeting: zod.record(FunctionTargetingSchema),
  schemaPath: zod.string().optional(),
  wasmPath: zod.string(),
  functionRunnerPath: zod.string(),
})

export const functionInfoJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionInfoResult',
  schema: FunctionInfoResultSchema,
  definitions: {
    FunctionTargeting: FunctionTargetingSchema,
  },
})

export type FunctionTargeting = zod.infer<typeof FunctionTargetingSchema>
export type FunctionInfoResult = InferJsonOutputSchema<typeof functionInfoJsonOutputSchema>
