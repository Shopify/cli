import {functionRunJsonOutputSchema} from '../runner/types.js'
import {defineJsonOutputSchema, jsonOutputTimestampSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const lifecycleSchema = zod
  .object({
    type: zod.literal('status'),
    timestamp: jsonOutputTimestampSchema,
    status: zod.enum(['watching', 'cancelled']),
  })
  .strict()

const buildSchema = zod.discriminatedUnion('status', [
  zod
    .object({
      type: zod.literal('build'),
      timestamp: jsonOutputTimestampSchema,
      status: zod.literal('success'),
    })
    .strict(),
  zod
    .object({
      type: zod.literal('build'),
      timestamp: jsonOutputTimestampSchema,
      status: zod.literal('failed'),
      error: zod.string().describe('The rebuild failure message.'),
    })
    .strict(),
])

const executionSchema = zod
  .object({
    type: zod.literal('execution'),
    timestamp: jsonOutputTimestampSchema,
    result: functionRunJsonOutputSchema.schema,
    exitCode: zod.number().int().nonnegative().describe('The exit code of this Function run, not the replay process.'),
  })
  .strict()

export const functionReplayRecordSchema = defineJsonOutputSchema({
  name: 'FunctionReplayRecord',
  schema: zod.union([lifecycleSchema, buildSchema, executionSchema]),
})

export const functionReplayJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionReplayOutput',
  schema: zod.union([functionRunJsonOutputSchema.schema, functionReplayRecordSchema.schema]),
  definitions: {
    FunctionRunResult: functionRunJsonOutputSchema.schema,
    FunctionReplayRecord: functionReplayRecordSchema.schema,
  },
})
