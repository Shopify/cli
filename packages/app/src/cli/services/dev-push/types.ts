import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appSchema = zod.object({name: zod.string(), clientId: zod.string().min(1)}).strict()
const warningSchema = zod.object({code: zod.string(), message: zod.string()}).strict()

export const appDevPushJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDevPushResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      app: appSchema,
      storeDomain: zod.string().describe('The canonical *.myshopify.com hostname of the development store.'),
      appUrl: zod.string().describe('The application URL configured in the uploaded preview.'),
      previewUrl: zod.string().describe('The admin URL for opening the app on the development store.'),
      warnings: zod.array(warningSchema).describe('Warnings returned by the preview API; codes are upstream values.'),
    })
    .strict(),
  definitions: {AppDevPushApp: appSchema, AppDevPushWarning: warningSchema},
})

export type DevPushResult = InferJsonOutputSchema<typeof appDevPushJsonOutputSchema>
