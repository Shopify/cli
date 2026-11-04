import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {LiquidValue} from '../../utilities/repl/evaluator.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {JsonErrorSchema} from '@shopify/cli-kit/node/error/schema'

const LiquidValueSchema: zod.ZodType<LiquidValue> = zod.lazy(() =>
  zod.union([
    zod.string(),
    zod.number().finite(),
    zod.boolean(),
    zod.null(),
    zod.array(LiquidValueSchema),
    zod.record(LiquidValueSchema),
  ]),
)

const ConsoleInputResultSchema = zod.discriminatedUnion('status', [
  zod
    .object({
      input: zod.string(),
      status: zod.literal('success'),
      value: LiquidValueSchema.describe('The native Liquid value. Assignments return null.'),
    })
    .strict(),
  zod.object({input: zod.string(), status: zod.literal('failed'), error: JsonErrorSchema}).strict(),
  zod
    .object({input: zod.string(), status: zod.literal('skipped'), reason: zod.literal('previous-input-failed')})
    .strict(),
])

const ConsoleResultSchema = zod
  .object({
    status: zod.enum(['success', 'partial']),
    results: zod.array(ConsoleInputResultSchema),
  })
  .strict()

export type ConsoleResult = zod.infer<typeof ConsoleResultSchema>

export const themeConsoleJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeConsoleResult',
  schema: ConsoleResultSchema,
  definitions: {ConsoleInputResult: ConsoleInputResultSchema, LiquidValue: LiquidValueSchema},
  project: (value) => value,
})
