import {FileType, TemplateType} from '../../utilities/generator.js'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export interface TemplateGeneratorOptions {
  name: string
  type: TemplateType
  path: string
  fileType: FileType
  resource: string
}

export async function generateTemplate(options: TemplateGeneratorOptions) {
  const templatePath = joinPath(options.path, 'templates', `${options.resource}.${options.name}.${options.fileType}`)

  // Check if template already exists
  if (await fileExists(templatePath)) {
    throw new Error(`Template ${options.name} already exists at ${templatePath}`)
  }

  // Write the file
  const content =
    options.fileType === 'liquid' ? generateLiquidTemplateContent(options) : generateJsonTemplateContent(options)

  await writeFile(templatePath, content)
  outputInfo(`Created template: ${templatePath}`)
}

function generateLiquidTemplateContent(options: TemplateGeneratorOptions): string {
  const baseSchema = {
    name: options.name,
    type: options.type,
    settings: [],
  }

  return `{% schema %}
${JSON.stringify(baseSchema, null, 2)}
{% endschema %}`
}

function generateJsonTemplateContent(options: TemplateGeneratorOptions): string {
  const schema = {
    sections: {
      main: {
        type: `main-${options.type}`,
        settings: {},
      },
    },
    order: ['main'],
  }

  return JSON.stringify(schema, null, 2)
}
