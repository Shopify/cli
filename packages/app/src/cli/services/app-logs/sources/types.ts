import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const sourceSchema = zod.object({
  source: zod.string(),
  namespace: zod.literal('extensions'),
  handle: zod.string(),
  name: zod.string(),
  type: zod.string(),
  externalType: zod.string(),
  humanName: zod.string(),
  uid: zod.string(),
  directory: zod.string(),
  configurationPath: zod.string(),
  configuration: zod.record(zod.unknown()),
  entrySourceFilePath: zod.string(),
  outputPath: zod.string(),
  surface: zod.string(),
  features: zod.array(zod.string()),
  dependency: zod.string().optional(),
})

export const appLogSourcesJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppLogSourcesResult',
  schema: zod.array(sourceSchema),
  definitions: {AppLogSource: sourceSchema},
})

export type AppLogSourcesResult = InferJsonOutputSchema<typeof appLogSourcesJsonOutputSchema>
