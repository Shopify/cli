import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeCheckOffenseSchema = zod.object({
  check: zod.string(),
  severity: zod.enum(['error', 'warning', 'info']),
  start_row: zod.number(),
  start_column: zod.number(),
  end_row: zod.number(),
  end_column: zod.number(),
  message: zod.string(),
})
const ThemeCheckFileSchema = zod.object({
  environment: zod.string().optional(),
  path: zod.string(),
  offenses: zod.array(ThemeCheckOffenseSchema),
  errorCount: zod.number(),
  warningCount: zod.number(),
  infoCount: zod.number(),
})
const ThemeCheckResultSchema = zod.array(ThemeCheckFileSchema)
const ThemeCheckEnvironmentSchema = zod.object({environment: zod.string(), result: ThemeCheckResultSchema})

export const themeCheckJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeCheckResult',
  schema: zod.union([ThemeCheckResultSchema, zod.object({environments: zod.array(ThemeCheckEnvironmentSchema)})]),
  definitions: {
    ThemeCheckOffense: ThemeCheckOffenseSchema,
    ThemeCheckFile: ThemeCheckFileSchema,
    ThemeCheckEnvironment: ThemeCheckEnvironmentSchema,
  },
})

export type ThemeCheckResult = zod.infer<typeof ThemeCheckResultSchema>
