import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const themePackageJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemePackageResult',
  schema: zod.object({path: zod.string()}),
})

export type ThemePackageResult = InferJsonOutputSchema<typeof themePackageJsonOutputSchema>
