import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue}

const LspValueSchema: zod.ZodType<JsonValue> = zod.lazy(() =>
  zod.union([
    zod.null(),
    zod.boolean(),
    zod.number().finite(),
    zod.string(),
    zod.array(LspValueSchema),
    zod.record(LspValueSchema),
  ]),
)

const LspIntegerSchema = zod.number().int().min(-2147483648).max(2147483647)
const LspIdSchema = zod.union([LspIntegerSchema, zod.string()])
const LspParamsSchema = zod.union([zod.record(LspValueSchema), zod.array(LspValueSchema)])
const LspRequestSchema = zod
  .object({
    jsonrpc: zod.literal('2.0'),
    id: LspIdSchema,
    method: zod.string(),
    params: LspParamsSchema.optional(),
  })
  .strict()
const LspNotificationSchema = LspRequestSchema.omit({id: true})
const LspSuccessResponseSchema = zod
  .object({jsonrpc: zod.literal('2.0'), id: LspIdSchema.nullable(), result: LspValueSchema})
  .strict()
const LspErrorResponseSchema = zod
  .object({
    jsonrpc: zod.literal('2.0'),
    id: LspIdSchema.nullable(),
    error: zod.object({code: LspIntegerSchema, message: zod.string(), data: LspValueSchema.optional()}).strict(),
  })
  .strict()

export const languageServerJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeLanguageServerMessage',
  schema: zod
    .union([LspRequestSchema, LspNotificationSchema, LspSuccessResponseSchema, LspErrorResponseSchema])
    .describe(
      'The JSON body of one native LSP message, framed with Content-Length headers on stdout. Method-specific params, results, and error data follow the Language Server Protocol specification.',
    ),
  definitions: {
    LspValue: LspValueSchema,
    LspRequest: LspRequestSchema,
    LspNotification: LspNotificationSchema,
    LspSuccessResponse: LspSuccessResponseSchema,
    LspErrorResponse: LspErrorResponseSchema,
  },
})
