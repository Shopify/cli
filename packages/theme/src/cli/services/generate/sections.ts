import {FileType, SectionType} from '../../utilities/generator.js'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export interface SectionGeneratorOptions {
  name: string
  type: SectionType
  path: string
  fileType: FileType
}

export async function generateSection(options: SectionGeneratorOptions) {
  const sectionPath = joinPath(options.path, 'sections', `${options.name}.${options.fileType}`)

  // Check if section already exists
  if (await fileExists(sectionPath)) {
    throw new Error(`Section ${options.name} already exists at ${sectionPath}`)
  }

  // Write the file
  const content =
    options.fileType === 'liquid' ? generateLiquidSectionContent(options) : generateJsonSectionContent(options)

  await writeFile(sectionPath, content)
  outputInfo(`Created section: ${sectionPath}`)
}

function generateLiquidSectionContent(options: SectionGeneratorOptions): string {
  const baseSchema = {
    name: options.name,
    settings: [],
  }

  return `{% schema %}
${JSON.stringify(baseSchema, null, 2)}
{% endschema %}`
}

function generateJsonSectionContent(options: SectionGeneratorOptions): string {
  const schema = {
    type: 'header',
    name: options.name,
    settings: [],
    order: [],
  }

  return JSON.stringify(schema, null, 2)
}
