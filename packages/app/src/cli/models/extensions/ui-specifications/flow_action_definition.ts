import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'

import {zod} from '@shopify/cli-kit/node/schema'

import {joinPath} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import fs from 'fs'

// TODO: we need to figure out if we can do inter field validation (e.g. CCP requires Preview and validation URLs)
const FlowActionDefinitionExtensionSchema = BaseUIExtensionSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_action_definition'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    url: zod.string(),
    validationUrl: zod.string().optional(),
    customConfigurationPageUrl: zod.string().optional(),
    customConfigurationPagePreviewUrl: zod.string().optional(),
    schema_patch_path: zod.string().optional(),
    return_type_ref: zod.string().optional(),
    fields: zod.array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
        label: zod.string(),
        description: zod.string().optional(),
        required: zod.boolean(),
        uiType: zod.string(),
      }),
    ),
  }),
})

/**
 * Extension specification with all properties and methods needed to load a UI extension.
 */
const flowActionDefinitionSpecification = createUIExtensionSpecification({
  identifier: 'flow_action_definition',
  schema: FlowActionDefinitionExtensionSchema,
  supportedFlavors: [],
  singleEntryPath: false,
  deployConfig: async (config, extensionPath) => {
    // TODO: we'll need to figure out a solution for how we manage generating UUIDs for fields
    // we can either ask the partner to provide them, or we can generate them for them but we'll need to update the config file
    return {
      title: config.task.title,
      description: config.task.description,
      url: config.task.url,
      fields: config.task.fields,
      validation_url: config.task.validationUrl,
      custom_configuration_page_url: config.task.customConfigurationPageUrl,
      custom_configuration_page_preview_url: config.task.customConfigurationPagePreviewUrl,
      return_type_ref: config.task.return_type_ref,
      schema_patch: await loadSchemaPatchFromPath(extensionPath, config.task.schema_patch_path),
    }
  },
})

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

  return fs.readFileSync(path[0] as string, 'utf8')
}

export default flowActionDefinitionSpecification
