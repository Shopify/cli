import {editorExtensionCollection} from './editor-extension-collection.js'
import {GenerateOptions} from '../../generate.js'
import {GeneratedExtension, GenerateExtensionTemplateOptions} from '../../generate/extension.js'
import { RenderAlertOptions } from '@shopify/cli-kit/node/ui'

interface AfterGenerateOptions {
  generateOptions: GenerateOptions
  extensionTemplateOptions: GenerateExtensionTemplateOptions
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
}
