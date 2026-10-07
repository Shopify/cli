import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const timestamp = zod
  .string()
  .datetime({offset: true})
  .describe('Producer/service RFC 3339 timestamp; fractional seconds are preserved.')
export const webhookSchema = zod
  .object({
    topic: zod.string().nullable(),
    resultStatus: zod.string().nullable(),
    statusCode: zod.string().nullable(),
    responseTimeMs: zod.number().int().nullable(),
    deliveryAttempt: zod.number().int().nullable(),
  })
  .strict()
export const functionSchema = zod
  .object({
    invocationId: zod.string().nullable(),
    functionHandle: zod.string().nullable(),
    target: zod.string().nullable(),
    resultStatus: zod.string().nullable(),
    executionDurationMs: zod.number().int().nullable(),
  })
  .strict()
const event = zod
  .object({
    gid: zod.string().startsWith('gid://shopify/AppLogRecord/'),
    timestamp,
    type: zod.string(),
    store: zod.string().nullable(),
    outcome: zod.enum(['success', 'failure']).nullable(),
    webhook: webhookSchema.nullable(),
    function: functionSchema.nullable(),
  })
  .strict()
const query = zod
  .object({
    clientId: zod.string(),
    types: zod.array(zod.string()),
    since: timestamp,
    until: timestamp,
    anchor: timestamp,
    clockSource: zod.literal('scope-response'),
    limit: zod.number().int().positive(),
  })
  .strict()

export const logsOutput = defineJsonOutputSchema({
  name: 'HistoricalAppLogs',
  schema: zod
    .object({
      status: zod.enum(['success', 'partial']),
      query,
      logs: zod.array(event),
      ordering: zod.literal('none'),
      pageInfo: zod
        .object({
          limit: zod.number().int().positive(),
          returnedCount: zod.number().int().nonnegative(),
          limitReached: zod.boolean(),
          moreRecordsMatched: zod.boolean().nullable(),
        })
        .strict(),
      errors: zod.array(
        zod
          .object({
            code: zod.string(),
            message: zod.string(),
            fieldPath: zod.array(zod.union([zod.string(), zod.number()])).optional(),
          })
          .strict(),
      ),
      limitations: zod.array(zod.string()),
    })
    .strict(),
  definitions: {AppLogEvent: event},
})

export type LogsResult = InferJsonOutputSchema<typeof logsOutput>
