import {devInstanceLogOutputSchema, type DevInstanceInfo} from '@shopify/cli-kit/node/dev-instance'
import {defineJsonOutputSchema, jsonOutputTimestampSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const previewSchema = zod
  .object({
    state: zod.enum(['starting', 'updating', 'ready', 'error']),
    message: zod.string().nullable(),
    errors: zod.array(zod.string()),
  })
  .strict()
  .describe('The CLI-reported preview state in the instance file; this is not a health check.')

const instanceSchema = zod
  .object({
    schemaVersion: zod.literal(1),
    sessionId: zod.string(),
    command: zod.literal('app dev'),
    key: zod.string().optional(),
    pid: zod.number().int().positive(),
    status: zod.enum(['starting', 'running']),
    startedAt: jsonOutputTimestampSchema,
    updatedAt: jsonOutputTimestampSchema,
    directory: zod.string(),
    logFile: zod.string(),
    details: zod
      .object({
        configPath: zod.string(),
        appName: zod.string(),
        clientId: zod.string(),
        storeFqdn: zod.string().optional(),
        previewUrl: zod.string().optional(),
        graphiqlUrl: zod.string().optional(),
        appUrl: zod.string().optional(),
        localUrl: zod.string().optional(),
        preview: previewSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .describe(
    'The instance JSON file under .shopify/dev/. This object is not emitted to stdout.',
  ) satisfies zod.ZodType<DevInstanceInfo>

export const appDevOutputSchema = defineJsonOutputSchema({
  name: devInstanceLogOutputSchema.name,
  schema: devInstanceLogOutputSchema.schema,
  definitions: {DevInstance: instanceSchema, DevPreview: previewSchema},
})
