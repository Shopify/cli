import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {error, file, git, output, path, string, template, ui, yaml, dependency} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'
import stream from 'node:stream'
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
  cloneUrl?: string
  language?: string
}

async function extensionInit(options: ExtensionInitOptions) {
  if (options.extensionType === 'theme') {
    await themeExtensionInit(options)
  } else if (functionExtensions.types.includes(options.extensionType)) {
    await functionExtensionInit(options)
  } else {
    await uiExtensionInit(options)
  }
}

async function themeExtensionInit({name, app, extensionType}: ExtensionInitOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists({app, name})
  const templatePath = await getTemplatePath('theme-extension')
  await template.recursiveDirectoryCopy(templatePath, extensionDirectory, {name, extensionType})
}

async function uiExtensionInit({name, extensionType, app}: ExtensionInitOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists({app, name})
  const list = new ui.Listr([
    {
      title: 'Scaffolding extension',
      task: async () => {
        const stdin = yaml.encode({
          extensions: [
            {
              title: name,
              // Use the new templates
              type: `${extensionType}_next`,
              metafields: [],
              development: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                root_dir: '.',
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
      },
    },
    {
      title: 'Installing additional dependencies',
      task: async (_, task) => {
        const requiredDependencies = getRuntimeDependencies({extensionType})
        dependency.addNPMDependenciesIfNeeded(requiredDependencies, {
          dependencyManager: app.dependencyManager,
          type: 'prod',
          directory: app.directory,
          stderr: new stream.Writable({
            write(chunk, encoding, next) {
              task.output = chunk.toString()
              next()
            },
          }),
          stdout: new stream.Writable({
            write(chunk, encoding, next) {
              task.output = chunk.toString()
              next()
            },
          }),
        })
      },
    },
  ])
  await list.run()
}

function getRuntimeDependencies({extensionType}: Pick<ExtensionInitOptions, 'extensionType'>): string[] {
  switch (extensionType) {
    case 'product_subscription':
      return ['react', '@shopify/admin-ui-extensions-react']
    case 'checkout_ui_extension':
      return ['react', '@shopify/checkout-ui-extensions-react']
    case 'checkout_post_purchase':
      return ['react', '@shopify/post-purchase-ui-extensions-react']
  }
  return []
}

async function functionExtensionInit(options: ExtensionInitOptions) {
  const extensionDirectory = await ensureExtensionDirectoryExists(options)
  const url = options.cloneUrl || blocks.functions.defaultUrl
  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')

    const list = new ui.Listr([
      {
        title: 'Scaffolding extension',
        task: async () => {
          await file.mkdir(templateDownloadDir)
          await git.downloadRepository({repoUrl: url, destination: templateDownloadDir})
          const origin = path.join(templateDownloadDir, functionTemplatePath(options))
          template.recursiveDirectoryCopy(origin, extensionDirectory, options)
        },
      },
    ])
    await list.run()
  })
}

function functionTemplatePath({extensionType, language}: ExtensionInitOptions): string {
  const lang = language || blocks.functions.defaultLanguage
  switch (extensionType) {
    case 'product_discount_type':
      return `discounts/${lang}/product-discount-type/default`
    case 'order_discount_type':
      return `discounts/${lang}/order-discount-type/default`
    case 'shipping_discount_type':
      return `discounts/${lang}/shipping-discount-type/default`
    case 'payment_methods':
      return `checkout/${lang}/payment-methods/default`
    case 'shipping_rate_presenter':
      return `checkout/${lang}/shipping-rate-presenter/default`
    default:
      throw new error.Abort('Invalid extension type')
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
