import {blocks, versions} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionSpec} from '../../models/extensions/functions.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {ThemeExtensionSpec} from '../../models/extensions/theme.js'
import {error, path, ui} from '@shopify/cli-kit'
import {
  addNPMDependenciesIfNeeded,
  addResolutionOrOverride,
  DependencyVersion,
} from '@shopify/cli-kit/node/node-package-manager'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {isUnitTest} from '@shopify/cli-kit/node/environment/local'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {fileExists, inTemporaryDirectory, mkdir, moveFile, removeFile} from '@shopify/cli-kit/node/fs'
import {fileURLToPath} from 'url'
import stream from 'stream'

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

interface ExtensionInitOptions<TSpec extends GenericSpecification = GenericSpecification> {
  name: string
  app: AppInterface
  cloneUrl?: string
  extensionFlavor?: ExtensionFlavor
  specification: TSpec
  extensionType: string
}

interface ExtensionDirectory {
  extensionDirectory: string
}

export type ExtensionFlavor = 'vanilla-js' | 'react' | 'typescript' | 'typescript-react' | string

type FunctionExtensionInitOptions = ExtensionInitOptions<FunctionSpec> & ExtensionDirectory
type UIExtensionInitOptions = ExtensionInitOptions<UIExtensionSpec> & ExtensionDirectory
type ThemeExtensionInitOptions = ExtensionInitOptions<ThemeExtensionSpec> & ExtensionDirectory

async function extensionInit(options: ExtensionInitOptions): Promise<string> {
  const extensionDirectory = await ensureExtensionDirectoryExists({app: options.app, name: options.name})
  switch (options.specification.category()) {
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

async function themeExtensionInit({name, app, specification, extensionDirectory}: ThemeExtensionInitOptions) {
  const templatePath = await getTemplatePath('theme-extension')
  await recursiveLiquidTemplateCopy(templatePath, extensionDirectory, {name, type: specification.identifier})
}

async function uiExtensionInit({
  name,
  specification,
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
          const requiredDependencies = getRuntimeDependencies({specification, extensionFlavor})
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
        title: `Generate ${specification.externalName} extension`,
        task: async (_, task) => {
          task.title = `Generating ${specification.externalName} extension...`

          const templateDirectory =
            specification.templatePath ??
            (await path.findUp(`templates/ui-extensions/projects/${specification.externalIdentifier}`, {
              type: 'directory',
              cwd: path.moduleDirectory(import.meta.url),
            }))

          if (!templateDirectory) {
            throw new error.Bug(`Couldn't find the template for ${specification.externalIdentifier}`)
          }

          const srcFileExtension = getSrcFileExtension(extensionFlavor ?? 'vanilla-js')
          await recursiveLiquidTemplateCopy(templateDirectory, extensionDirectory, {
            srcFileExtension,
            flavor: extensionFlavor ?? '',
            type: specification.identifier,
            name,
          })

          if (extensionFlavor) {
            await changeIndexFileExtension(extensionDirectory, srcFileExtension)
            await removeUnwantedTemplateFilesPerFlavor(extensionDirectory, extensionFlavor)
          }

          task.title = `${specification.externalName} extension generated`
        },
      },
    ],
    {rendererSilent: isUnitTest()},
  )
  await list.run()
}

type SrcFileExtension = 'ts' | 'tsx' | 'js' | 'jsx'
function getSrcFileExtension(extensionFlavor: ExtensionFlavor): SrcFileExtension {
  const flavorToSrcFileExtension: {[key in ExtensionFlavor]: SrcFileExtension} = {
    'vanilla-js': 'js',
    react: 'jsx',
    typescript: 'ts',
    'typescript-react': 'tsx',
  }

  return flavorToSrcFileExtension[extensionFlavor] ?? 'js'
}

export function getRuntimeDependencies({
  specification,
  extensionFlavor,
}: Pick<UIExtensionInitOptions, 'specification' | 'extensionFlavor'>): DependencyVersion[] {
  const dependencies: DependencyVersion[] = []
  if (extensionFlavor?.includes('react')) {
    dependencies.push({name: 'react', version: versions.react})
  }
  const rendererDependency = specification.dependency
  if (rendererDependency) {
    dependencies.push(rendererDependency)
  }
  return dependencies
}

async function changeIndexFileExtension(extensionDirectory: string, fileExtension: SrcFileExtension) {
  const srcFilePaths = await path.glob(path.join(extensionDirectory, 'src', '*'))
  const srcFileExensionsToChange = []

  for (const srcFilePath of srcFilePaths) {
    srcFileExensionsToChange.push(moveFile(srcFilePath, `${srcFilePath}.${fileExtension}`))
  }

  await Promise.all(srcFileExensionsToChange)
}

async function removeUnwantedTemplateFilesPerFlavor(extensionDirectory: string, extensionFlavor: ExtensionFlavor) {
  // tsconfig.json file is only needed in extension folder to inform the IDE
  // About the `react-jsx` tsconfig option, so IDE don't complain about missing react import
  if (extensionFlavor !== 'typescript-react') {
    await removeFile(path.join(extensionDirectory, 'tsconfig.json'))
  }
}

async function functionExtensionInit(options: FunctionExtensionInitOptions) {
  const url = options.cloneUrl || options.specification.templateURL
  const spec = options.specification
  await inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')

    await ui.task({
      title: `Generating ${spec.externalName} extension...`,
      task: async () => {
        await mkdir(templateDownloadDir)
        await downloadGitRepository({
          repoUrl: url,
          destination: templateDownloadDir,
          shallow: true,
        })
        const templatePath = spec.templatePath(options.extensionFlavor ?? blocks.functions.defaultLanguage)
        const origin = path.join(templateDownloadDir, templatePath)
        await recursiveLiquidTemplateCopy(origin, options.extensionDirectory, options)
        const configYamlPath = path.join(options.extensionDirectory, 'script.config.yml')
        if (await fileExists(configYamlPath)) {
          await removeFile(configYamlPath)
        }
        return {
          successMessage: `${spec.externalName} extension generated`,
        }
      },
    })
  })
}

async function ensureExtensionDirectoryExists({name, app}: {name: string; app: AppInterface}): Promise<string> {
  const hyphenizedName = hyphenate(name)
  const extensionDirectory = path.join(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await fileExists(extensionDirectory)) {
    throw new error.Abort(
      `\nA directory with this name (${hyphenizedName}) already exists.\nChoose a new name for your extension.`,
    )
  }
  await mkdir(extensionDirectory)
  return extensionDirectory
}

async function addResolutionOrOverrideIfNeeded(directory: string, extensionFlavor?: ExtensionFlavor) {
  if (extensionFlavor === 'typescript-react') {
    await addResolutionOrOverride(directory, {'@types/react': versions.reactTypes})
  }
}

export default extensionInit
