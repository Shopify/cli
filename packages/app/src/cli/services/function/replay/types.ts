import {functionRunJsonOutputSchema} from '../runner/types.js'
import {
  defineJsonOutputSchema,
  jsonOutputTimestampSchema,
  type InferJsonOutputSchema,
} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const lifecycleSchema = zod
  .object({
    type: zod.literal('status'),
    timestamp: jsonOutputTimestampSchema,
    status: zod.enum(['watching', 'cancelled']),
  })
  .strict()

const buildSchema = zod
  .object({
    type: zod.literal('build'),
    timestamp: jsonOutputTimestampSchema,
    status: zod.enum(['success', 'failed']),
  })
  .strict()

const executionSchema = zod
  .object({
    type: zod.literal('execution'),
    timestamp: jsonOutputTimestampSchema,
    result: functionRunJsonOutputSchema.schema,
    exitCode: zod.number().int().nonnegative(),
  })
  .strict()

export const functionReplayEventSchema = defineJsonOutputSchema({
  name: 'FunctionReplayEvent',
  schema: zod.discriminatedUnion('type', [lifecycleSchema, buildSchema, executionSchema]),
})

export type FunctionReplayEvent = InferJsonOutputSchema<typeof functionReplayEventSchema>

export const functionReplayJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionReplayOutput',
  schema: zod.union([functionRunJsonOutputSchema.schema, functionReplayEventSchema.schema]),
  definitions: {
    FunctionRunResult: functionRunJsonOutputSchema.schema,
    FunctionReplayEvent: functionReplayEventSchema.schema,
  },
})
