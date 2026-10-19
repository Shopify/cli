import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'

export const themePackageJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemePackageResult',
  schema: zod
    .object({path: zod.string().refine(isAbsolutePath).describe('The absolute native path of the ZIP archive.')})
    .strict(),
})

export type ThemePackageResult = InferJsonOutputSchema<typeof themePackageJsonOutputSchema>
