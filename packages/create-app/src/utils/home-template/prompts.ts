import {configurationFileNames} from '../../constants'
import {homeTemplateSchema} from '../../models/home-template'
import {file, path, toml} from '@shopify/cli-kit'

export default async function askPrompts(directory: string) {
  const templatePath = path.join(directory, configurationFileNames.homeTemplate)

  if (await file.exists(templatePath)) {
    const rawToml = await file.read(templatePath)
    return homeTemplateSchema.parse(await toml.decode(rawToml))
  } else {
    return []
  }
}
