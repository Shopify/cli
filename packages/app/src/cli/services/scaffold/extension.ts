import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {error, file, output, path, string, template, yaml} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'
import {blocks, ExtensionTypes, functionExtensions} from '$cli/constants'
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

interface ExtensionInitOptions {
  name: string
  extensionType: ExtensionTypes
  app: App
}

async function extensionInit({name, extensionType, app}: ExtensionInitOptions) {
  if (extensionType === 'theme') {
    await themeExtensionInit({name, extensionType, app})
  } else if (functionExtensions.types.includes(extensionType)) {
    // Do soemething
  } else {
    await argoExtensionInit({name, extensionType, app})
  }
}

async function themeExtensionInit({name, app, extensionType}: ExtensionInitOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists({app, name})
  const templatePath = await getTemplatePath('theme-extension')
  await template.recursiveDirectoryCopy(templatePath, extensionDirectory, {name, extensionType})
}

async function argoExtensionInit({name, extensionType, app}: ExtensionInitOptions) {
  const hyphenizedName = string.hyphenize(name)
  const extensionDirectory = await ensureExtensionDirectoryExists({app, name})
  const stdin = yaml.encode({
    extensions: [
      {
        title: hyphenizedName,
        // Use the new templates
        type: `${extensionType}_next`,
        metafields: [],
        development: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: hyphenizedName,
        },
      },
    ],
  })
  await runGoExtensionsCLI(['create', '-'], {
    cwd: extensionDirectory,
    stdout: process.stdout,
    stderr: process.stderr,
    stdin,
  })
}

async function ensureExtensionDirectoryExists({name, app}: Omit<ExtensionInitOptions, 'extensionType'>) {
  const hyphenizedName = string.hyphenize(name)
  const extensionDirectory = path.join(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await file.exists(extensionDirectory)) {
    throw new error.Abort(`Extension ${hyphenizedName} already exists!`)
  }
  await file.mkdir(extensionDirectory)
  return extensionDirectory
}

async function writeFromTemplate({promptAnswers, filename, alias, directory}: WriteFromTemplateOptions) {
  const _alias = alias || filename
  output.info(output.content`Generating ${_alias}`)
  const templatePath = await getTemplatePath('extensions')
  const templateItemPath = path.join(templatePath, filename)
  const content = await file.read(templateItemPath)
  const contentOutput = await template.create(content)(promptAnswers)
  const fullpath = path.join(directory, _alias)
  await file.write(fullpath, contentOutput)
}

export default extensionInit
