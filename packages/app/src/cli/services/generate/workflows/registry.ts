import {editorExtensionCollection} from './editor-extension-collection.js'
import {discountDetailsFunctionSettingsCollection} from './discount-details-function-settings-collection.js'
import {functionWithAdminUi} from './function-with-admin-ui.js'
import {GeneratedExtension, GenerateExtensionTemplateOptions} from '../../generate/extension.js'
import {GenerateOptions} from '../../generate.js'
import {ExtensionTemplate} from '../../../models/app/template.js'
import {RenderAlertOptions} from '@shopify/cli-kit/node/ui'

interface AfterGenerateOptions {
  generateOptions: GenerateOptions
  extensionTemplateOptions: GenerateExtensionTemplateOptions
  extensionTemplates: ExtensionTemplate[]
  generatedExtension: GeneratedExtension
}

export interface WorkflowResult {
  success: boolean
  message?: RenderAlertOptions
}

export interface Workflow {
  afterGenerate: (options: AfterGenerateOptions) => Promise<WorkflowResult>
  flags?: {
    [key: string]: unknown
  }
}

interface WorkflowRegistry {
  [key: string]: Workflow
}

export const workflowRegistry: WorkflowRegistry = {
  editor_extension_collection: editorExtensionCollection,
  discount_details_function_settings: discountDetailsFunctionSettingsCollection,
  product_discounts: functionWithAdminUi('discount_details_function_settings'),
  order_discounts: functionWithAdminUi('discount_details_function_settings'),
  shipping_discounts: functionWithAdminUi('discount_details_function_settings'),
  cart_checkout_validation: functionWithAdminUi('validation_settings_ui'),
}

/**
 * EXPERIMENT: Pass through additional flags for each workflow, and ensure they are dependent on the template flag.
 * This works at the OCLIF layer but we would need to determine how to pass the flags to the `generate` service and the workflows.
 * @returns Additional flags for the `generate extension` command.
 */
export function workflowFlags() {
  return Object.keys(workflowRegistry).reduce<{[key: string]: unknown}>((flags, templateIdentifier) => {
    const workflow = workflowRegistry[templateIdentifier]
    if (workflow?.flags === undefined) {
      return flags
    }
    Object.keys(workflow.flags).forEach((flagName) => {
      if (workflow.flags === undefined) {
        return
      }
      const flag = workflow.flags[flagName] as {relationships?: {type: string; flags: unknown[]}[]}
      if (!flag.relationships) {
        flag.relationships = [
          {
            type: 'none',
            flags: [
              {
                name: 'template',
                when: (flags: {template?: string}) => flags.template !== templateIdentifier,
              },
            ],
          },
        ]
      }
      flags[flagName] = flag
    })
    return flags
  }, {})
}
