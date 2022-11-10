import {
  blocks,
  extensionTypeCategory,
  ExtensionTypes,
  getExtensionOutputConfig,
  getUIExtensionRendererDependency,
  ThemeExtensionTypes,
  UIExtensionTypes,
  FunctionExtensionTypes,
  versions,
} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {mapExtensionTypeToExternalExtensionType} from '../../utilities/extensions/name-mapper.js'
import {error, file, git, path, string, template, ui, environment} from '@shopify/cli-kit'
import {
  addNPMDependenciesIfNeeded,
  addResolutionOrOverride,
  DependencyVersion,
} from '@shopify/cli-kit/node/node-package-manager'
import {fileURLToPath} from 'url'
import stream from 'node:stream'

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

interface ExtensionInitOptions<TExtensionTypes extends ExtensionTypes = ExtensionTypes> {
  name: string
  extensionType: TExtensionTypes
  app: AppInterface
  cloneUrl?: string
  extensionFlavor?: ExtensionFlavor
}

export type ExtensionFlavor = 'vanilla-js' | 'react' | 'typescript' | 'typescript-react'

interface ExtensionDirectory {
  extensionDirectory: string
}

type FunctionExtensionInitOptions = ExtensionInitOptions<FunctionExtensionTypes> & ExtensionDirectory
type UIExtensionInitOptions = ExtensionInitOptions<UIExtensionTypes> & ExtensionDirectory
type ThemeExtensionInitOptions = ExtensionInitOptions<ThemeExtensionTypes> & ExtensionDirectory

async function extensionInit(options: ExtensionInitOptions): Promise<string> {
  const extensionDirectory = await ensureExtensionDirectoryExists({app: options.app, name: options.name})
  switch (extensionTypeCategory(options.extensionType)) {
    case 'theme':
      await themeExtensionInit({...(options as ThemeExtensionInitOptions), extensionDirectory})
      break
    case 'function':
      await functionExtensionInit({...(options as FunctionExtensionInitOptions), extensionDirectory})
      break
    case 'ui':
      await uiExtensionInit({...(options as UIExtensionInitOptions), extensionDirectory})
      break
  }
  return extensionDirectory
}

async function themeExtensionInit({name, app, extensionType, extensionDirectory}: ThemeExtensionInitOptions) {
  const templatePath = await getTemplatePath('theme-extension')
  await template.recursiveDirectoryCopy(templatePath, extensionDirectory, {name, extensionType})
}

async function uiExtensionInit({
  name,
  extensionType,
  app,
  extensionFlavor,
  extensionDirectory,
}: UIExtensionInitOptions) {
  const list = ui.newListr(
    [
      {
        title: 'Install additional dependencies',
        task: async (_, task) => {
          task.title = 'Installing additional dependencies...'
          await addResolutionOrOverrideIfNeeded(app.directory, extensionFlavor)
          const requiredDependencies = getRuntimeDependencies({extensionType, extensionFlavor})
          await addNPMDependenciesIfNeeded(requiredDependencies, {
            packageManager: app.packageManager,
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
          task.title = 'Dependencies installed'
        },
      },
      {
        title: `Generate ${getExtensionOutputConfig(extensionType).humanKey} extension`,
        task: async (_, task) => {
          task.title = `Generating ${getExtensionOutputConfig(extensionType).humanKey} extension...`

          const templateDirectory = await path.findUp(
            `templates/ui-extensions/projects/${mapExtensionTypeToExternalExtensionType(extensionType)}`,
            {
              type: 'directory',
              cwd: path.moduleDirectory(import.meta.url),
            },
          )

          if (!templateDirectory) {
            throw new error.Bug(`Couldn't find the template for ${extensionType}`)
          }

          await template.recursiveDirectoryCopy(templateDirectory, extensionDirectory, {
            flavor: extensionFlavor ?? '',
            type: extensionType,
            name,
          })

          if (extensionFlavor) {
            await changeIndexFileExtension(extensionDirectory, extensionFlavor)
            await removeUnwantedTemplateFilesPerFlavor(extensionDirectory, extensionFlavor)
          }

          task.title = `${getExtensionOutputConfig(extensionType).humanKey} extension generated`
        },
      },
    ],
    {rendererSilent: environment.local.isUnitTest()},
  )
  await list.run()
}

export function getRuntimeDependencies({
  extensionType,
  extensionFlavor,
}: Pick<UIExtensionInitOptions, 'extensionType' | 'extensionFlavor'>): DependencyVersion[] {
  const dependencies: DependencyVersion[] = []
  if (extensionFlavor?.includes('react')) {
    dependencies.push({name: 'react', version: versions.react})
  }
  const rendererDependency = getUIExtensionRendererDependency(extensionType)
  if (rendererDependency) {
    dependencies.push(rendererDependency)
  }
  return dependencies
}

async function changeIndexFileExtension(extensionDirectory: string, extensionFlavor: ExtensionFlavor) {
  const fileExtensionsMapper = {
    'vanilla-js': 'js',
    react: 'jsx',
    typescript: 'ts',
    'typescript-react': 'tsx',
  }

  const fileExtension = fileExtensionsMapper[extensionFlavor]

  if (fileExtension) {
    await file.move(
      path.join(extensionDirectory, 'src/index'),
      path.join(extensionDirectory, `src/index.${fileExtension}`),
    )
  }
}

async function removeUnwantedTemplateFilesPerFlavor(extensionDirectory: string, extensionFlavor: ExtensionFlavor) {
  // tsconfig.json file is only needed in extension folder to inform the IDE
  // About the `react-jsx` tsconfig option, so IDE don't complain about missing react import
  if (extensionFlavor !== 'typescript-react') {
    await file.remove(path.join(extensionDirectory, 'tsconfig.json'))
  }
}

async function functionExtensionInit(options: FunctionExtensionInitOptions) {
  const url = options.cloneUrl || blocks.functions.defaultUrl
  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')

    await ui.task({
      title: `Generating ${getExtensionOutputConfig(options.extensionType).humanKey} extension...`,
      task: async () => {
        await file.mkdir(templateDownloadDir)
        await git.downloadRepository({
          repoUrl: url,
          destination: templateDownloadDir,
          shallow: true,
        })
        const origin = path.join(templateDownloadDir, functionTemplatePath(options))
        await template.recursiveDirectoryCopy(origin, options.extensionDirectory, options)
        const configYamlPath = path.join(options.extensionDirectory, 'script.config.yml')
        if (await file.exists(configYamlPath)) {
          await file.remove(configYamlPath)
        }
        return {
          successMessage: `${getExtensionOutputConfig(options.extensionType).humanKey} extension generated`,
        }
      },
    })
  })
}

function functionTemplatePath({extensionType, extensionFlavor}: FunctionExtensionInitOptions): string {
  const lang = extensionFlavor || blocks.functions.defaultLanguage
  switch (extensionType) {
    case 'product_discounts':
      return `discounts/${lang}/product-discounts/default`
    case 'order_discounts':
      return `discounts/${lang}/order-discounts/default`
    case 'shipping_discounts':
      return `discounts/${lang}/shipping-discounts/default`
    case 'payment_customization':
      return `checkout/${lang}/payment-customization/default`
    case 'shipping_rate_presenter':
      return `checkout/${lang}/shipping-rate-presenter/default`
    case 'delivery_customization':
      return `checkout/${lang}/delivery-customization/default`
    default:
      return 'unknown'
  }
}

async function ensureExtensionDirectoryExists({name, app}: {name: string; app: AppInterface}): Promise<string> {
  const hyphenizedName = string.hyphenize(name)
  const extensionDirectory = path.join(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await file.exists(extensionDirectory)) {
    throw new error.Abort(
      `\nA directory with this name (${hyphenizedName}) already exists.\nChoose a new name for your extension.`,
    )
  }
  await file.mkdir(extensionDirectory)
  return extensionDirectory
}

async function addResolutionOrOverrideIfNeeded(directory: string, extensionFlavor?: ExtensionFlavor) {
  if (extensionFlavor === 'typescript-react') {
    await addResolutionOrOverride(directory, {'@types/react': versions.reactTypes})
  }
}

export default extensionInit
