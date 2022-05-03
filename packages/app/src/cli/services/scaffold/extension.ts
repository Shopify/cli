import {error, file, git, output, path, string, template, ui} from '@shopify/cli-kit'
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
  cloneUrl: string
  language: string
}

interface ExtensionLocalTemplateOptions {
  name: string
  extensionType: ExtensionTypes
  app: App
}

async function extensionInit(options: ExtensionInitOptions) {
  if (options.extensionType === 'theme') {
    await themeExtensionInit(options)
  } else if (functionExtensions.types.includes(options.extensionType)) {
    await functionExtensionInit(options)
  } else {
    await argoExtensionInit(options)
  }
}
async function themeExtensionInit({name, app, extensionType}: ExtensionLocalTemplateOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists({app, name})
  const templatePath = await getTemplatePath('theme-extension')
  await template.recursiveDirectoryCopy(templatePath, extensionDirectory, {name, extensionType})
}

async function argoExtensionInit({name, extensionType, app}: ExtensionLocalTemplateOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists({app, name})
  await Promise.all(
    [
      {filename: 'config.toml', alias: blocks.extensions.configurationName.ui},
      {filename: `${extensionType}.jsx`, alias: 'index.js'},
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

async function functionExtensionInit(options: ExtensionInitOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists(options)
  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')

    const list = new ui.Listr([
      {
        title: 'Scaffolding extension',
        task: async () => {
          await file.mkdir(templateDownloadDir)
          await git.downloadRepository({repoUrl: options.cloneUrl, destination: templateDownloadDir})
          const origin = path.join(templateDownloadDir, functionTemplatePath(options))
          template.recursiveDirectoryCopy(origin, extensionDirectory, {})
        },
      },
    ])
    await list.run()
  })
}

function functionTemplatePath({extensionType, language}: ExtensionInitOptions): string {
  switch (extensionType) {
    case 'product_discount_type':
      return `discounts/${language}/product-discount-type/default`
    case 'order_discount_type':
      return `discounts/${language}/order-discount-type/default`
    case 'shipping_discount_type':
      return `discounts/${language}/shipping-discount-type/default`
    case 'payment_methods':
      return `checkout/${language}/payment-methods/default`
    case 'shipping_rate_presenter':
      return `checkout/${language}/shipping-rate-presenter/default`
    default:
      throw new error.Fatal('Invalid extension type')
  }
}

async function ensureExtensionDirectoryExists({name, app}: {name: string; app: App}) {
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
