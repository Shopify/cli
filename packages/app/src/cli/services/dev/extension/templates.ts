import {path, file, error} from '@shopify/cli-kit'
import {renderLiquidTemplate} from '@shopify/cli-kit/node/liquid'

export interface GetHTMLOptions {
  extensionSurface?: string
  template: Template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export type Template = 'index' | 'tunnel-error' | 'error'

export class TemplateNotFoundError extends error.Bug {
  constructor(options: GetHTMLOptions) {
    super(`Couldn't find template ${options.template} for extension surface ${options.extensionSurface}`)
  }
}

export async function getHTML(options: GetHTMLOptions): Promise<string> {
  const templatePath = await getTemplatePath(options)
  const templateContent = await file.read(templatePath)
  return renderLiquidTemplate(templateContent, options.data)
}

export async function getTemplatePath(options: GetHTMLOptions): Promise<string> {
  const templatesDirectory = await getTemplatesDirectory()
  const globPatterns = []
  if (options.extensionSurface) {
    globPatterns.push(path.join(templatesDirectory, `${options.extensionSurface}/${options.template}.html.liquid`))
  }
  globPatterns.push(path.join(templatesDirectory, `${options.template}.html.liquid`))
  const globMatches = await path.glob(globPatterns)
  if (globMatches.length === 0) {
    throw new TemplateNotFoundError(options)
  }
  return globMatches[0] as string
}

export async function getTemplatesDirectory(): Promise<string> {
  const directory = await path.findUp('templates/ui-extensions/html', {
    type: 'directory',
    cwd: path.moduleDirectory(import.meta.url),
  })
  return directory as string
}
