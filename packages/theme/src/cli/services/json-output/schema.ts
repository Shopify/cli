import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {JsonErrorSchema} from '@shopify/cli-kit/node/error/schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const ThemeIdSchema = zod
  .string()
  .regex(/^\d+$/)
  .describe('The decimal Online Store theme ID, not a Shopify GID.')
export const StoreDomainSchema = zod
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
  .nullable()
export const ThemeSchema = zod
  .object({
    id: ThemeIdSchema,
    name: zod.string(),
    role: zod.string().describe('The upstream theme role; known values include main, unpublished, and development.'),
  })
  .strict()
export const ThemeLinksSchema = ThemeSchema.extend({
  storeDomain: StoreDomainSchema,
  previewUrl: zod.string().url().nullable(),
  editorUrl: zod.string().url().nullable(),
}).strict()
export const CancelledSchema = zod.object({status: zod.literal('cancelled')}).strict()

export type ThemeEnvironmentResult =
  | {environment: string; result: unknown}
  | {environment: string; error: zod.infer<typeof JsonErrorSchema>}

/** A command-specific projection is also applied to each successful environment result. */
export function defineThemeJsonOutputSchema<TSchema extends zod.ZodTypeAny>(options: {
  name: string
  schema: TSchema
  definitions?: Record<string, zod.ZodTypeAny>
  project: (value: unknown) => unknown
}) {
  const resultSchema = zod.union([options.schema, CancelledSchema])
  const environmentSchema = zod.union([
    zod.object({environment: zod.string(), result: resultSchema}).strict(),
    zod.object({environment: zod.string(), error: JsonErrorSchema}).strict(),
  ])
  const output = defineJsonOutputSchema({
    name: options.name,
    schema: zod.union([resultSchema, zod.object({environments: zod.array(environmentSchema)}).strict()]),
    definitions: {...options.definitions, ThemeEnvironment: environmentSchema},
  })
  const projectResult = (value: unknown) => (CancelledSchema.safeParse(value).success ? value : options.project(value))
  return {
    ...output,
    encode(value: unknown): string {
      const batch = zod
        .object({environments: zod.array(zod.unknown())})
        .strict()
        .safeParse(value)
      if (!batch.success) return JSON.stringify(output.validate(projectResult(value)), null, 2)
      const environments = batch.data.environments.map((item) => {
        const entry = zod
          .union([
            zod.object({environment: zod.string(), result: zod.unknown()}).strict(),
            zod.object({environment: zod.string(), error: JsonErrorSchema}).strict(),
          ])
          .parse(item)
        return 'error' in entry ? entry : {...entry, result: projectResult(entry.result)}
      })
      return JSON.stringify(output.validate({environments}), null, 2)
    },
  }
}

export function themeId(value: number | string): string {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError('Theme IDs must be safe nonnegative integers or decimal strings.')
  }
  return ThemeIdSchema.parse(String(value))
}

export function storeDomain(value: string | null | undefined): string | null {
  return value && StoreDomainSchema.safeParse(value).success ? value : null
}

export function projectTheme(theme: {id: number | string; name: string; role: string}) {
  return {id: themeId(theme.id), name: theme.name, role: theme.role}
}
