import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemePushThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  shop: zod.string(),
  editor_url: zod.string(),
  preview_url: zod.string(),
})

const ThemePushJsonThemeSchema = ThemePushThemeSchema.extend({
  warning: zod.string().optional(),
  errors: zod.record(zod.array(zod.string())).optional(),
})

const ThemePushJsonResultSchema = zod.object({
  environment: zod.string().optional(),
  theme: ThemePushJsonThemeSchema,
})

const outputSchema = defineJsonOutputSchema({
  name: 'ThemePushJsonResult',
  schema: zod.union([
    ThemePushJsonResultSchema,
    zod.array(ThemePushJsonResultSchema.extend({environment: zod.string()})),
  ]),
  definitions: {ThemePushTheme: ThemePushJsonThemeSchema},
})

export const themePushJsonOutputSchema: typeof outputSchema = {
  ...outputSchema,
  // Preserve the compact JSON emitted by theme push, including member order.
  encode: (result: InferJsonOutputSchema<typeof outputSchema>) => JSON.stringify(outputSchema.validate(result)),
}

export const themePushResultSchema = zod.object({
  environment: zod.string().optional(),
  theme: ThemePushThemeSchema,
  published: zod.boolean(),
  hasErrors: zod.boolean(),
  errors: zod.record(zod.array(zod.string())),
})

export type ThemePushResult = zod.infer<typeof themePushResultSchema>
export type ThemePushJsonResult = zod.infer<typeof ThemePushJsonResultSchema>
