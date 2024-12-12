import {FileType} from '../../utilities/generator.js'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export interface TemplateGeneratorOptions {
  name: string | undefined
  path: string
  fileType: FileType
  resource: string
}

export async function generateTemplate(options: TemplateGeneratorOptions) {
  let templatePath =
    options.name === undefined
      ? joinPath(options.path, 'templates', `${options.resource}.${options.fileType}`)
      : joinPath(options.path, 'templates', `${options.resource}.${options.name}.${options.fileType}`)

  // eslint-disable-next-line no-await-in-loop
  while (await fileExists(templatePath)) {
    const filename = templatePath.split('/').pop()
    // eslint-disable-next-line no-await-in-loop
    const newName = await renderTextPrompt({
      message: `Template ${filename} already exists. Please provide a new name:`,
    })
    templatePath = joinPath(options.path, 'templates', `${options.resource}.${newName}.${options.fileType}`)
  }

  // Write the file
  const content =
    options.fileType === 'liquid' ? generateLiquidTemplateContent(options) : generateJsonTemplateContent(options)

  await writeFile(templatePath, content)
  outputInfo(`Created template: ${templatePath}`)
}

function generateLiquidTemplateContent(options: TemplateGeneratorOptions): string {
  const baseSchema = {
    name: options.resource,
    type: options.resource,
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
        type: `main-${options.resource}`,
        settings: {},
      },
    },
    order: ['main'],
  }

  return JSON.stringify(schema, null, 2)
}
