import {getTriggerPreview} from '../../../services/flow/preview.js'
import {BaseSchema} from '../schemas.js'

import {createExtensionSpecification} from '../specification.js'
import {writeFileSync, mkdir, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'

const FlowTriggerExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_trigger'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    fields: zod
      .array(
        zod.object({
          name: zod.string(),
          description: zod.string().optional(),
          id: zod.string(),
          ui_type: zod.string(),
        }),
      )
      .min(1),
  }),
})

/**
 * Extension specification with all properties and methods needed to load a Flow Trigger.
 */
const flowTriggerSpecification = createExtensionSpecification({
  identifier: 'flow_trigger',
  schema: FlowTriggerExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    return {
      title: config.task.title,
      description: config.task.description,
      fields: config.task.fields,
    }
  },
  postBuildAction: async (extension) => {
    const directoryPath = joinPath(extension.outputPath, 'data')

    if (!fileExistsSync(directoryPath)) {
      await mkdir(directoryPath)
    }

    writeFileSync(
      joinPath(directoryPath, 'payload-preview.gql'),
      getTriggerPreview(extension.devUUID, extension.configuration.task.fields),
    )
  },
})

export default flowTriggerSpecification
