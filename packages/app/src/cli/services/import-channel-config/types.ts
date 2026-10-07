import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const channelSpecExportWarningSchema = zod
  .object({
    code: zod.string(),
    message: zod.string(),
  })
  .strict()

export const importChannelConfigJsonOutputSchema = defineJsonOutputSchema({
  name: 'ImportChannelConfigResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      handle: zod.string(),
      filename: zod.string(),
      path: zod
        .string()
        .regex(/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/, 'The path must be absolute.')
        .describe('Absolute path of the written TOML file.'),
      toml: zod.string().describe('Native channel_config TOML content, unchanged from the export.'),
      warnings: zod.array(channelSpecExportWarningSchema).describe('Warnings returned with the channel spec export.'),
    })
    .strict(),
  definitions: {ChannelSpecExportWarning: channelSpecExportWarningSchema},
})

export type ImportChannelConfigResult = InferJsonOutputSchema<typeof importChannelConfigJsonOutputSchema>

export type ImportedChannelConfig = ImportChannelConfigResult & {extensionConfigurationPath: string | null}
