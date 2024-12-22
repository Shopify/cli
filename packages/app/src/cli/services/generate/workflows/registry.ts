import {editorExtensionCollection} from './editor-extension-collection.js'
import {GenerateOptions} from '../../generate.js'
import {GeneratedExtension, GenerateExtensionTemplateOptions} from '../../generate/extension.js'
import {RenderAlertOptions} from '@shopify/cli-kit/node/ui'
import {discountDetailsFunctionSettingsCollection} from './discount-details-function-settings-collection.js'
import {productDiscountFunctionCollection} from './product-discount-function-collection.js'
import {ExtensionTemplate} from '../../../models/app/template.js'

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
}

interface WorkflowRegistry {
  [key: string]: Workflow
}

export const workflowRegistry: WorkflowRegistry = {
  editor_extension_collection: editorExtensionCollection,
  discount_details_function_settings: discountDetailsFunctionSettingsCollection,
  product_discounts: productDiscountFunctionCollection,
}
