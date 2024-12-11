import {Workflow} from './registry.js'

export const editorExtensionCollection: Workflow = {
  afterGenerate: async (options) => {
    console.log('hello world')
  },
}
