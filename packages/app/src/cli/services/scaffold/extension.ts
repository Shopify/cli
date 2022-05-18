import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {blocks, ExtensionTypes, functionExtensions, uiExtensionRendererDependency} from '../../constants'
import {error, file, git, path, string, template, ui, yaml, dependency} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'
import stream from 'node:stream'
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
      title: 'Installing additional dependencies',
      task: async (_, task) => {
        const requiredDependencies = getRuntimeDependencies({extensionType})
        await dependency.addNPMDependenciesIfNeeded(requiredDependencies, {
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
  ])
  await list.run()
}

export function getRuntimeDependencies({extensionType}: Pick<ExtensionInitOptions, 'extensionType'>): string[] {
  switch (extensionType) {
    case 'product_subscription':
    case 'checkout_ui_extension':
    case 'checkout_post_purchase':
      // eslint-disable-next-line no-case-declarations
      const dependencies = ['react']
      // eslint-disable-next-line no-case-declarations
      const rendererDependency = uiExtensionRendererDependency(extensionType)
      if (rendererDependency) {
        dependencies.push(rendererDependency)
      }
      return dependencies
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

export default extensionInit
