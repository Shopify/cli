import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const nativeLogRecord = zod
  .object({
    id: zod.string().startsWith('gid://shopify/AppLogRecord/'),
    timestamp: zod.string().datetime().describe('Native API timestamp; fractional seconds are preserved.'),
    type: zod.string().describe('Native API enum, such as WEBHOOK_DELIVERY or GRAPHQL_REQUEST.'),
    resultStatus: zod.string().nullable(),
    shopMyshopifyDomain: zod.string().nullable(),
  })
  .passthrough()
  .describe(
    'Native record JSON. All additional approved API fields are preserved without renaming or truncation; this is not a deep per-type schema.',
  )

export const logsOutput = defineJsonOutputSchema({
  name: 'HistoricalAppLogs',
  schema: zod
    .object({
      logs: zod.array(nativeLogRecord),
      ordering: zod
        .enum(['subset-timestamp-asc', 'timestamp-asc', 'timestamp-desc'])
        .describe(
          'subset-timestamp-asc sorts only the returned subset in the CLI, not necessarily the oldest or newest matches. timestamp-asc and timestamp-desc request server sorting before the limit.',
        ),
      limitations: zod.array(zod.string()),
    })
    .strict(),
  definitions: {AppLogRecord: nativeLogRecord},
})

export type LogsResult = InferJsonOutputSchema<typeof logsOutput>
