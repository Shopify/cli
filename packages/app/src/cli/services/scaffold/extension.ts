import {fileURLToPath} from 'url'

import {error, file, output, path, string, template} from '@shopify/cli-kit'

import {blocks, ExtensionTypes} from '../../constants'
import {load as loadApp, App} from '../../app/app'

async function getTemplatePath(name: string): Promise<string> {
  const templatePath = await path.findUp(`templates/${name}`, {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  })
  if (templatePath) {
    return templatePath
  } else {
    throw new error.Bug(`Couldn't find the template ${name} in @shopify/app.`)
  }
}

interface WriteFromTemplateOptions {
  promptAnswers: any
  filename: string
  alias?: string
  directory: string
}
async function writeFromTemplate({
  promptAnswers,
  filename,
  alias,
  directory,
}: WriteFromTemplateOptions) {
  const _alias = alias || filename
  output.message(output.content`Generating ${_alias}`)
  const templatePath = await getTemplatePath('extensions')
  const templateItemPath = path.join(templatePath, filename)
  const content = await file.read(templateItemPath)
  const contentOutput = await template(content)(promptAnswers)
  const fullpath = path.join(directory, _alias)
  await file.write(fullpath, contentOutput)
}

interface ExtensionInitOptions {
  name: string
  extensionType: ExtensionTypes
  parentApp: App
}
async function extensionInit({
  name,
  extensionType,
  parentApp,
}: ExtensionInitOptions) {
  const hyphenizedName = string.hyphenize(name)
  const extensionDirectory = path.join(
    parentApp.directory,
    blocks.uiExtensions.directoryName,
    hyphenizedName,
  )
  if (await file.exists(extensionDirectory)) {
    throw new error.Abort(`Extension ${hyphenizedName} already exists!`)
  }
  await file.mkdir(extensionDirectory)
  await Promise.all(
    [
      {filename: 'config.toml', alias: blocks.uiExtensions.configurationName},
      {filename: `${extensionType}.jsx`, alias: 'index.jsx'},
    ].map((fileDetails) =>
      writeFromTemplate({
        ...fileDetails,
        directory: extensionDirectory,
        promptAnswers: {
          name,
          extensionType,
        },
      }),
    ),
  )
}

export default extensionInit
