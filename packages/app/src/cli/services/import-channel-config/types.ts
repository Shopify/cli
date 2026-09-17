import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const channelSpecExportWarningSchema = zod.object({
  code: zod.string(),
  message: zod.string(),
})

export const importChannelConfigJsonOutputSchema = defineJsonOutputSchema({
  name: 'ImportChannelConfigResult',
  schema: zod.object({
    handle: zod.string(),
    filename: zod.string(),
    path: zod.string(),
    toml: zod.string(),
    warnings: zod.array(channelSpecExportWarningSchema),
  }),
  definitions: {ChannelSpecExportWarning: channelSpecExportWarningSchema},
})
