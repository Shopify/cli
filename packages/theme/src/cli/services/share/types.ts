import {themePushJsonOutputSchema} from '../push/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'

export const themeShareJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeShareResult',
  schema: themePushJsonOutputSchema.schema,
  definitions: themePushJsonOutputSchema.definitions,
})

export type ThemeShareResult = InferJsonOutputSchema<typeof themeShareJsonOutputSchema>
