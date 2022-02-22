import {fileURLToPath} from 'url'

import {path, error} from '@shopify/cli-kit'

export async function template(name: string): Promise<string> {
  const templatePath = await path.findUp(`templates/${name}`, {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  })
  if (templatePath) {
    return templatePath
  } else {
    throw new error.Bug(
      `Couldn't find the template ${name} in @shopify/create-app.`,
    )
  }
}
