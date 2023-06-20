import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {getActionPreview} from '../../../services/flow/preview.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile, writeFileSync, mkdir, fileExistsSync} from '@shopify/cli-kit/node/fs'

import {zod} from '@shopify/cli-kit/node/schema'

const FlowActionExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_action'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    url: zod.string(),
    validation_url: zod.string().optional(),
    custom_configuration_page_url: zod.string().optional(),
    custom_configuration_page_preview_url: zod.string().optional(),
    schema: zod.string().optional(),
    return_type_ref: zod.string().optional(),
    fields: zod
      .array(
        zod.object({
          id: zod.string(),
          name: zod.string(),
          label: zod.string(),
          description: zod.string().optional(),
          required: zod.boolean(),
          ui_type: zod.string(),
        }),
      )
      .optional(),
  }),
})

/**
 * Loads the schema from the partner defined file.
 */
const loadSchemaPatchFromPath = async (extensionPath: string, patchPath: string | undefined) => {
  if (!patchPath) {
    return ''
  }

  const path = await glob(joinPath(extensionPath, patchPath))

  if (path.length > 1) {
    throw new Error('Multiple files found for schema patch path')
  } else if (path.length === 0) {
    return ''
  }

  return readFile(path[0] as string)
}

/**
 * Extension specification with all properties and methods needed to load a Flow Action.
 */
const flowActionSpecification = createExtensionSpecification({
  identifier: 'flow_action',
  schema: FlowActionExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, extensionPath) => {
    return {
      title: config.task.title,
      description: config.task.description,
      url: config.task.url,
      fields: config.task.fields,
      validation_url: config.task.validation_url,
      custom_configuration_page_url: config.task.custom_configuration_page_url,
      custom_configuration_page_preview_url: config.task.custom_configuration_page_preview_url,
      return_type_ref: config.task.return_type_ref,
      schema_patch: await loadSchemaPatchFromPath(extensionPath, config.task.schema),
    }
  },
  postBuildAction: async (extension) => {
    const directoryPath = joinPath(extension.outputPath, 'data')

    if (!fileExistsSync(directoryPath)) {
      await mkdir(directoryPath)
    }

    writeFileSync(
      joinPath(directoryPath, 'payload-preview.json'),
      getActionPreview(
        extension.configuration.task.title,
        Boolean(extension.configuration.task.custom_configuration_page_url),
        extension.configuration.task.fields,
      ),
    )
  },
})

export default flowActionSpecification
