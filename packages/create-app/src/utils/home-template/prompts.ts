import {file, path, toml, ui} from '@shopify/cli-kit'

import {configurationFileNames} from '../../constants'
import {homeTemplateSchema} from '../../models/home-template'

export default async function askPrompts(directory: string) {
  const homeConfigs = await getHomeConfigs(directory)

  // TODO: Do we need to distinguish frontend/backend prompts?
  // Idea: We can add a name/prefix in the shopify.home.template.toml
  const allPrompts = homeConfigs.flatMap((config) => config.prompts)

  return allPrompts.length ? ui.prompt(allPrompts) : {}
}

async function getHomeConfigs(directory: string) {
  const globPath = path.join(directory, '**', configurationFileNames.homeTemplate)
  const configFilePaths = await path.glob(globPath)
  const results = []

  for (const configFilePath of configFilePaths) {
    results.push(parseConfiguration(configFilePath))
  }

  return Promise.all(results)
}

async function parseConfiguration(tomlPath: string) {
  const rawToml = await file.read(tomlPath)
  return homeTemplateSchema.parse(await toml.decode(rawToml))
}
