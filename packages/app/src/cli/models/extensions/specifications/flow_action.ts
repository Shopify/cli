import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'

import {zod} from '@shopify/cli-kit/node/schema'

const startsWithHttps = (url: string) => url.startsWith('https://')

const FlowActionExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('flow_action'),
  task: zod.object({
    title: zod.string(),
    description: zod.string(),
    url: zod.string().url().refine(startsWithHttps),
    validationUrl: zod.string().url().refine(startsWithHttps).optional(),
    customConfigurationPageUrl: zod.string().url().refine(startsWithHttps).optional(),
    customConfigurationPagePreviewUrl: zod.string().url().refine(startsWithHttps).optional(),
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
          uiType: zod.string(),
        }),
      )
      .optional(),
  }),
}).refine((config) => {
  const {task} = config

  if (task.customConfigurationPageUrl || task.customConfigurationPagePreviewUrl) {
    if (!task.customConfigurationPageUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['task.custom_configuration_page_url'],
          message: 'To set a custom configuration page a `custom_configuration_page_url` must be specified.',
        },
      ])
    }

    if (!task.customConfigurationPagePreviewUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['task.custom_configuration_page_preview_url'],
          message: 'To set a custom configuration page a `custom_configuration_page_preview_url` must be specified.',
        },
      ])
    }

    if (!task.validationUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['task.validation_url'],
          message: 'To set a custom configuration page a `validation_url` must be specified.',
        },
      ])
    }
  }

  return true
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
      validation_url: config.task.validationUrl,
      custom_configuration_page_url: config.task.customConfigurationPageUrl,
      custom_configuration_page_preview_url: config.task.customConfigurationPagePreviewUrl,
      return_type_ref: config.task.return_type_ref,
      schema_patch: await loadSchemaPatchFromPath(extensionPath, config.task.schema),
    }
  },
})

export default flowActionSpecification
