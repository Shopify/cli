import {defineJsonOutputSchema, jsonOutputTimestampSchema, type InferJsonOutputSchema} from '../json-output-schema.js'
import {zod} from '../schema.js'

const storeDomain = zod.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
const timestamp = jsonOutputTimestampSchema

/** Lifecycle records written as JSONL by the standalone GraphiQL commands. */
export const graphiqlJsonOutputSchema = defineJsonOutputSchema({
  name: 'GraphiQLRecord',
  definitions: {GraphiQLTimestamp: timestamp, GraphiQLStoreDomain: storeDomain},
  schema: zod.discriminatedUnion('type', [
    zod.object({type: zod.literal('starting'), timestamp, storeDomain}).strict(),
    zod
      .object({
        type: zod.literal('ready'),
        timestamp,
        url: zod.string().url().describe('Local browser URL, including the session authentication key.'),
        storeDomain,
        api: zod.literal('admin'),
        apiVersion: zod.string().nullable().describe('Requested API version; null uses the latest stable version.'),
        mutationsAllowed: zod.boolean(),
        app: zod.object({name: zod.string(), url: zod.string().url()}).strict().nullable(),
      })
      .strict(),
    zod
      .object({
        type: zod.literal('stopped'),
        timestamp,
        reason: zod.enum(['cancelled', 'sigint', 'sigterm', 'sigquit']),
      })
      .strict(),
  ]),
})

type WithoutTimestamp<T> = T extends unknown ? Omit<T, 'timestamp'> : never
type GraphiQLRecord = InferJsonOutputSchema<typeof graphiqlJsonOutputSchema>
export type GraphiQLRecordInput = WithoutTimestamp<GraphiQLRecord>
