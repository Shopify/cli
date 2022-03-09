import {fileURLToPath} from 'url'

import {path, error} from '@shopify/cli-kit'

export async function template(
  name: string,
  options: {cwd?: string} = {},
): Promise<string> {
  const templatePath = await path.findUp(`templates/${name}`, {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
    ...options,
  })
  if (templatePath) {
    return templatePath
  } else {
    // TODO Check remote sources for templates
    throw new error.Bug(`Couldn't find the template ${name}.`)
  }
}
