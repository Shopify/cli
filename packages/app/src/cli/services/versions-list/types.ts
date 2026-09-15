import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appVersionJsonOutputSchema = zod.object({
  message: zod.string(),
  versionTag: zod.string().nullable().optional(),
  status: zod.string(),
  createdAt: zod.string(),
  createdBy: zod.string(),
  versionId: zod.string(),
})

export const appVersionsListJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppVersionsListResult',
  schema: zod.array(appVersionJsonOutputSchema),
  definitions: {AppVersion: appVersionJsonOutputSchema},
})

export type AppVersionsListResult = InferJsonOutputSchema<typeof appVersionsListJsonOutputSchema>
