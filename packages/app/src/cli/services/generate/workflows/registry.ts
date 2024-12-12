import {editorExtensionCollection} from './editor-extension-collection.js'
import {GenerateOptions} from '../../generate.js'
import {GeneratedExtension, GenerateExtensionTemplateOptions} from '../../generate/extension.js'

interface AfterGenerateOptions {
  generateOptions: GenerateOptions
  extensionTemplateOptions: GenerateExtensionTemplateOptions
  generatedExtension: GeneratedExtension
}

export interface Workflow {
  afterGenerate: (options: AfterGenerateOptions) => Promise<void>
}

interface WorkflowRegistry {
  [key: string]: Workflow
}

export const workflowRegistry: WorkflowRegistry = {
  editor_extension_collection: editorExtensionCollection,
}
