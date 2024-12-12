import {BlockType} from '../../utilities/generator.js'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export interface BlockGeneratorOptions {
  name: string
  type: BlockType
  path: string
}

export async function generateBlock(options: BlockGeneratorOptions) {
  const blockPath = joinPath(options.path, 'blocks', `${options.name}.liquid`)

  // Check if block already exists
  if (await fileExists(blockPath)) {
    throw new Error(`Block ${options.name} already exists at ${blockPath}`)
  }

  // Write the file
  await writeFile(blockPath, generateBlockContent(options))
  outputInfo(`Created block: ${blockPath}`)
}

function generateBlockContent(options: BlockGeneratorOptions): string {
  const baseSchema = {
    name: options.name,
    settings: [],
  }

  return `{% schema %}
${JSON.stringify(baseSchema, null, 2)}
{% endschema %}`
}
