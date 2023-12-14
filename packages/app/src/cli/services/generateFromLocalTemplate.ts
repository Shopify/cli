import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'

export interface GenerateFromLocalTemplateOptions {
  template: string
  directory: string
  options?: {[key: string]: unknown}
}

export interface LocalTemplate {
  identifier: string
  supportLinks: string[]
}

export interface GenerateFromLocalTemplatePromptOutput {
  localTemplate: LocalTemplate
  localTemplateContent: GenerateFromLocalTemplateContentOutput[]
}

export interface GenerateFromLocalTemplateContentOutput {
  index: number
  name: string
}

export interface GeneratedOutput {
  directory: string
  localTemplate: LocalTemplate
}

async function generateFromLocalTemplate({template, directory, options}: GenerateFromLocalTemplateOptions) {
  await renderLocalTemplate({template, directory, options})

  renderSuccessMessages([
    {
      directory,
      localTemplate: {identifier: template, supportLinks: []},
    },
  ])
}

interface RenderLocalTemplateOptions {
  template: string
  directory: string
  options?: {[key: string]: unknown}
}

async function renderLocalTemplate({template, directory, options = {}}: RenderLocalTemplateOptions) {
  // @todo: this is a hack to get the templates directory
  const templateDirectory = joinPath(moduleDirectory(import.meta.url), '..', '..', '..', 'templates', template)

  const tasks = [
    {
      title: `Generating files`,
      task: async () => {
        await recursiveLiquidTemplateCopy(templateDirectory, directory, options)
      },
    },
  ]

  await renderTasks(tasks)
}

function renderSuccessMessages(generatedExtensions: GeneratedOutput[]) {
  generatedExtensions.forEach((extension) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage(extension.localTemplate, extension.directory)
    renderSuccess(formattedSuccessfulMessage)
  })
}

function formatSuccessfulRunMessage(localTemplate: LocalTemplate, outputDirectory: string): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your files were created in', {filePath: outputDirectory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  if (localTemplate.supportLinks[0]) {
    options.reference!.push(['For more details, see the', {link: {label: 'docs', url: localTemplate.supportLinks[0]}}])
  }

  return options
}

export default generateFromLocalTemplate
