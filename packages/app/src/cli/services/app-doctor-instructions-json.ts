import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const AppDoctorInstructionsConfigurationSchema = zod
  .object({
    identity: zod.string(),
    path: zod.string(),
    name: zod.string(),
    client_id: zod.string().optional(),
  })
  .strict()

const AppDoctorInstructionsCommandSchema = zod
  .object({command: zod.literal('shopify'), args: zod.array(zod.string())})
  .strict()

const AppDoctorInstructionsScopeSchema = zod
  .object({
    scope_identity: zod.string(),
    directory: zod.string(),
    token: zod.string(),
    record_command: AppDoctorInstructionsCommandSchema,
    findings_path: zod.string(),
  })
  .strict()

const AppDoctorInstructionsCheckSchema = zod
  .object({
    id: zod.string(),
    version: zod.number().int().positive(),
    prompt_hash: zod.string(),
    prompt: zod.string(),
  })
  .strict()

export const appDoctorInstructionsJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDoctorInstructionsResult',
  schema: zod
    .object({
      schema_version: zod.literal(1),
      configuration: AppDoctorInstructionsConfigurationSchema,
      app_root: zod.string(),
      scopes: zod.array(AppDoctorInstructionsScopeSchema),
      checks: zod.array(AppDoctorInstructionsCheckSchema),
      /** The complete markdown handed to the agent; the same text `--json`-less output prints. */
      instructions: zod.string(),
    })
    .strict(),
  definitions: {
    AppDoctorInstructionsConfiguration: AppDoctorInstructionsConfigurationSchema,
    AppDoctorInstructionsCommand: AppDoctorInstructionsCommandSchema,
    AppDoctorInstructionsScope: AppDoctorInstructionsScopeSchema,
    AppDoctorInstructionsCheck: AppDoctorInstructionsCheckSchema,
  },
})

export type AppDoctorInstructionsResult = InferJsonOutputSchema<typeof appDoctorInstructionsJsonOutputSchema>
