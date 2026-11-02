import {devInstanceLogOutputSchema, type DevInstanceInfo} from '@shopify/cli-kit/node/dev-instance'
import {defineJsonOutputSchema, jsonOutputTimestampSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const instanceSchema = zod
  .object({
    schemaVersion: zod.literal(1),
    sessionId: zod.string(),
    command: zod.literal('theme dev'),
    key: zod.string().optional(),
    pid: zod.number().int().positive(),
    status: zod.enum(['starting', 'running']),
    startedAt: jsonOutputTimestampSchema,
    updatedAt: jsonOutputTimestampSchema,
    directory: zod.string(),
    logFile: zod.string(),
    details: zod
      .object({
        store: zod.string(),
        themeId: zod.number(),
        themeName: zod.string(),
        listing: zod.string().optional(),
        host: zod.string().optional(),
        port: zod.number().int().positive().optional(),
        urls: zod
          .object({
            local: zod.string(),
            preview: zod.string(),
            themeEditor: zod.string(),
            giftCard: zod.string(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict()
  .describe(
    'The instance JSON file under .shopify/dev/. This object is not emitted to stdout.',
  ) satisfies zod.ZodType<DevInstanceInfo>

export const themeDevOutputSchema = defineJsonOutputSchema({
  name: devInstanceLogOutputSchema.name,
  schema: devInstanceLogOutputSchema.schema,
  definitions: {DevInstance: instanceSchema},
})
