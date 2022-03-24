import {error, file, output, path, string, template} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'
import {blocks, UiExtensionTypes} from '$cli/constants'
import {App} from '$cli/models/app/app'

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
async function writeFromTemplate({promptAnswers, filename, alias, directory}: WriteFromTemplateOptions) {
  const _alias = alias || filename
  output.info(output.content`Generating ${_alias}`)
  const templatePath = await getTemplatePath('ui-extensions')
  const templateItemPath = path.join(templatePath, filename)
  const content = await file.read(templateItemPath)
  const contentOutput = await template.create(content)(promptAnswers)
  const fullpath = path.join(directory, _alias)
  await file.write(fullpath, contentOutput)
}

interface UiExtensionInitOptions {
  name: string
  uiExtensionType: UiExtensionTypes
  parentApp: App
}
async function uiExtensionInit({name, uiExtensionType, parentApp}: UiExtensionInitOptions) {
  const hyphenizedName = string.hyphenize(name)
  const uiExtensionDirectory = path.join(parentApp.directory, blocks.uiExtensions.directoryName, hyphenizedName)
  if (await file.exists(uiExtensionDirectory)) {
    throw new error.Abort(`UI Extension ${hyphenizedName} already exists!`)
  }
  await file.mkdir(uiExtensionDirectory)
  await Promise.all(
    [
      {filename: 'config.toml', alias: blocks.uiExtensions.configurationName},
      {filename: `${uiExtensionType}.jsx`, alias: 'index.jsx'},
    ].map((fileDetails) =>
      writeFromTemplate({
        ...fileDetails,
        directory: uiExtensionDirectory,
        promptAnswers: {
          name,
          uiExtensionType,
        },
      }),
    ),
  )
}

export default uiExtensionInit
