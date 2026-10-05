import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const nativeValueSchema = zod.unknown().refine((value) => value !== undefined, 'The native value must be present.')

export const functionRunJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionRunResult',
  // Native Function runner 7.x/9.x protocol. Keep upstream keys and arbitrary payloads intact.
  schema: zod
    .object({
      name: zod.string(),
      size: zod.number().int().nonnegative().describe('Module size in kilobytes, as reported by Function runner.'),
      memory_usage: zod
        .number()
        .int()
        .nonnegative()
        .describe('Linear memory usage in kilobytes, as reported by Function runner.'),
      instructions: zod.number().int().nonnegative(),
      logs: zod.string(),
      input: nativeValueSchema.describe('Native Function input; query keys and values are preserved.'),
      output: nativeValueSchema.describe(
        'Native Function output, including the runner-specific invalid-output representation.',
      ),
      success: zod
        .boolean()
        .describe('False for a completed Function execution that failed; the command exits nonzero.'),
    })
    .passthrough()
    .describe('The native JSON object produced by Function runner 7.x and 9.x. Extra upstream fields are preserved.'),
})

export type FunctionRunResult = InferJsonOutputSchema<typeof functionRunJsonOutputSchema>
