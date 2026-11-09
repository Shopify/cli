import {logFilters, selectedLogTypes} from './catalog.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

type LogTypeName = ReturnType<typeof selectedLogTypes>[number]['name']
type LogFilterName = (typeof logFilters)[number]['flag']

const LogTypeSchema = zod
  .object({
    name: zod.enum(selectedLogTypes().map(({name}) => name) as [LogTypeName, ...LogTypeName[]]),
    description: zod.string(),
    filters: zod
      .array(zod.enum(logFilters.map(({flag}) => flag) as [LogFilterName, ...LogFilterName[]]))
      .describe('Applicable filter flag names for app logs-next, without the -- prefix.'),
    limitations: zod.array(zod.string()),
    example: zod.string(),
  })
  .strict()

export const logTypesJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppLogTypes',
  schema: zod
    .object({
      types: zod
        .array(LogTypeSchema)
        .describe('The complete local catalog, or one selected type. Does not check app access or log availability.'),
    })
    .strict(),
})

export type LogTypesResult = InferJsonOutputSchema<typeof logTypesJsonOutputSchema>

const commonLimitations = [
  'Each filter accepts one exact value. Different filters combine with AND; records without the filtered field are excluded.',
  '--status accepts success or failure using the recorded result status, not inferred from HTTP codes or response bodies.',
]

const typeDetails: Record<LogTypeName, Omit<LogTypesResult['types'][number], 'name'>> = {
  webhook: {
    description: 'Webhook delivery logs.',
    filters: ['store', 'status', 'topic', 'status-code'],
    limitations: [
      ...commonLimitations,
      '--topic requires an exact slash-form topic, such as orders/create. --status-code accepts an exact HTTP code from 100 to 599.',
    ],
    example: 'shopify app logs-next --type webhook --topic orders/create --since 30m',
  },
  graphql: {
    description: 'GraphQL request logs.',
    filters: ['store', 'status', 'operation-type', 'operation-name', 'request-id'],
    limitations: [
      ...commonLimitations,
      '--operation-name matches the client-supplied operation name, not a root API field. --operation-type matches the recorded operation kind; --request-id matches the request identifier.',
    ],
    example: 'shopify app logs-next --type graphql --operation-name MyQuery --since 30m',
  },
}

export function discoverLogTypes(type?: string): LogTypesResult {
  return logTypesJsonOutputSchema.validate({
    types: selectedLogTypes(type).map(({name}) => ({name, ...typeDetails[name]})),
  })
}
