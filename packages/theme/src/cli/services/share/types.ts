import {themePushJsonOutputSchema} from '../push/types.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'

const outputSchema = defineJsonOutputSchema({
  name: 'ThemeShareResult',
  schema: themePushJsonOutputSchema.schema,
  definitions: themePushJsonOutputSchema.definitions,
})

export const themeShareJsonOutputSchema: Omit<typeof outputSchema, 'encode'> & {encode(value: unknown): string} = {
  ...outputSchema,
  encode: themePushJsonOutputSchema.encode,
}
