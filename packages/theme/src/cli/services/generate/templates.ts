import {FileType, TemplateResourceType, TemplateType} from '../../utilities/generator.js'
import {writeFile, readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export interface TemplateGeneratorOptions {
  name: string | undefined
  type: TemplateType
  path: string
  fileType: FileType
  resource: TemplateResourceType
}

export async function generateTemplate(options: TemplateGeneratorOptions) {
  const {content, filePath} = await getFileContent(options)

  await writeFile(filePath, content)
  outputInfo(`Created template: ${filePath}`)
}

/**
 * Returns the content to write to the file and the path to write to.
 * If the base template exists, it copies the base template and the path will point to resource.name.liquid|json
 * If the base template does not exist, it generates the content and the path will point to resource.liquid|json
 */
async function getFileContent(options: TemplateGeneratorOptions): Promise<{content: string; filePath: string}> {
  const baseTemplatePath = joinPath(options.path, 'templates', `${options.resource}.${options.fileType}`)
  const baseTemplateExists = await fileExists(baseTemplatePath)

  if (baseTemplateExists) {
    const pathToWrite = joinPath(options.path, 'templates', `${options.resource}.${options.name}.${options.fileType}`)
    return {content: await readFile(baseTemplatePath), filePath: pathToWrite}
  } else {
    return {content: generateFileContent(options), filePath: baseTemplatePath}
  }
}

function generateFileContent(options: TemplateGeneratorOptions): string {
  return options.fileType === 'liquid'
    ? generateLiquidTemplateContent(options.resource)
    : generateJsonTemplateContent(options.resource)
}

function generateLiquidTemplateContent(resource: TemplateResourceType): string {
  const baseSchema = {
    name: resource,
    type: resource,
    settings: [],
  }

  return `{% schema %}
${JSON.stringify(baseSchema, null, 2)}
{% endschema %}`
}

function generateJsonTemplateContent(resource: TemplateResourceType): string {
  const schema = {
    sections: {
      main: {
        type: `main-${resource}`,
        settings: {},
      },
    },
    order: ['main'],
  }

  return JSON.stringify(schema, null, 2)
}
