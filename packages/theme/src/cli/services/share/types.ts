import {themePushJsonOutputSchema} from '../push/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'

const outputSchema = defineJsonOutputSchema({
  name: 'ThemeShareResult',
  schema: themePushJsonOutputSchema.schema,
  definitions: themePushJsonOutputSchema.definitions,
})

export const themeShareJsonOutputSchema = {...outputSchema, encode: themePushJsonOutputSchema.encode}

export type ThemeShareResult = InferJsonOutputSchema<typeof themeShareJsonOutputSchema>
