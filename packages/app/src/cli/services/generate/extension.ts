import {blocks, versions} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionSpec} from '../../models/extensions/functions.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {ThemeExtensionSpec} from '../../models/extensions/theme.js'
import {buildGraphqlTypes} from '../function/build.js'
import {ensureFunctionExtensionFlavorExists} from '../function/common.js'
import {getActiveDashboardExtensions} from '../getActiveDashboardExtensions.js'
import {
  addNPMDependenciesIfNeeded,
  addResolutionOrOverride,
  DependencyVersion,
} from '@shopify/cli-kit/node/node-package-manager'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {fileExists, inTemporaryDirectory, mkdir, moveFile, removeFile, glob, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, moduleDirectory, relativizePath} from '@shopify/cli-kit/node/path'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fileURLToPath} from 'url'

async function getTemplatePath(name: string): Promise<string> {
  const templatePath = await findPathUp(`templates/${name}`, {
    cwd: dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  })
  if (templatePath) {
    return templatePath
  } else {
    throw new BugError(`Couldn't find the template ${name} in @shopify/app.`)
  }
}

export interface ExtensionInitOptions<TSpec extends GenericSpecification = GenericSpecification> {
  name: string
  app: AppInterface
  cloneUrl?: string
  extensionFlavor?: ExtensionFlavorValue
  specification: TSpec
  extensionType: string
  apiKey?: string
}

interface ExtensionDirectory {
  extensionDirectory: string
}

interface FunctionFlavor {
  extensionFlavor: ExtensionFlavorValue
}

export type ExtensionFlavorValue = 'vanilla-js' | 'react' | 'typescript' | 'typescript-react' | 'rust' | 'wasm'

type FunctionExtensionInitOptions = ExtensionInitOptions<FunctionSpec> & ExtensionDirectory & FunctionFlavor
type UIExtensionInitOptions = ExtensionInitOptions<UIExtensionSpec> & ExtensionDirectory
type ThemeExtensionInitOptions = ExtensionInitOptions<ThemeExtensionSpec> & ExtensionDirectory

export type TemplateLanguage = 'javascript' | 'rust' | 'wasm'
function getTemplateLanguage(flavor: ExtensionFlavorValue): TemplateLanguage {
  switch (flavor) {
    case 'vanilla-js':
    case 'react':
    case 'typescript':
    case 'typescript-react':
      return 'javascript'
    case 'rust':
    case 'wasm':
      return flavor
  }
}

export interface GeneratedExtension {
  directory: string
  specification: GenericSpecification
}

export async function generateExtension(
  extensionOptions: ExtensionInitOptions[],
  app: AppInterface,
): Promise<GeneratedExtension[]> {
  return Promise.all(
    extensionOptions.flatMap(async (options) => {
      const extensionDirectory = await ensureExtensionDirectoryExists({app: options.app, name: options.name})
      switch (options.specification.category()) {
        case 'theme':
          await themeExtensionInit({...(options as ThemeExtensionInitOptions), extensionDirectory})
          break
        case 'function':
          await functionExtensionInit({...(options as FunctionExtensionInitOptions), extensionDirectory})
          break
        case 'ui':
          await uiExtensionInit({
            ...(options as UIExtensionInitOptions),
            extensionDirectory,
            app,
            apiKey: options.apiKey,
          })
          break
      }
      return {directory: relativizePath(extensionDirectory), specification: options.specification}
    }),
  )
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
  apiKey,
}: UIExtensionInitOptions) {
  const tasks = [
    {
      title: 'Installing dependencies',
      task: async () => {
        await addResolutionOrOverrideIfNeeded(app.directory, extensionFlavor)
        const requiredDependencies = getExtensionRuntimeDependencies({specification, extensionFlavor})
        await addNPMDependenciesIfNeeded(requiredDependencies, {
          packageManager: app.packageManager,
          type: 'prod',
          directory: app.directory,
        })
      },
    },
    {
      title: `Generating ${specification.externalName} extension`,
      task: async () => {
        const templateDirectory =
          specification.templatePath ??
          (await findPathUp(`templates/ui-extensions/projects/${specification.identifier}`, {
            type: 'directory',
            cwd: moduleDirectory(import.meta.url),
          }))

        if (!templateDirectory) {
          throw new BugError(`Couldn't find the template for '${specification.externalName}'`)
        }

        const activeDashboardExtensions = await getActiveDashboardExtensions({app, apiKey})
        console.log(activeDashboardExtensions)

        const promises = []
        if (activeDashboardExtensions.length > 0) {
          for (const extension of activeDashboardExtensions) {
            if (extension === undefined) continue
            const srcFileExtension = getSrcFileExtension(extensionFlavor ?? 'vanilla-js')
            const extensionConfig = JSON.parse(extension.activeVersion.config)
            console.log('got extension config', extensionConfig)

            promises.push(
              recursiveLiquidTemplateCopy(templateDirectory, extensionDirectory, {
                srcFileExtension,
                flavor: extensionFlavor ?? '',
                type: specification.identifier,
                name,
                ...extensionConfig,
              }),
            )
          }
        }
        Promise.all(promises)
          .then((results) => {
            console.log('done', results)
          })
          .catch((err) => {
            console.log('error', err)
          })
        // if (extensionFlavor) {
        //   await changeIndexFileExtension(extensionDirectory, srcFileExtension)
        //   await removeUnwantedTemplateFilesPerFlavor(extensionDirectory, extensionFlavor)
        // }
      },
    },
  ]
  await renderTasks(tasks)
}

type SrcFileExtension = 'ts' | 'tsx' | 'js' | 'jsx' | 'rs' | 'wasm'
function getSrcFileExtension(extensionFlavor: ExtensionFlavorValue): SrcFileExtension {
  const flavorToSrcFileExtension: {[key in ExtensionFlavorValue]: SrcFileExtension} = {
    'vanilla-js': 'js',
    react: 'jsx',
    typescript: 'ts',
    'typescript-react': 'tsx',
    rust: 'rs',
    wasm: 'wasm',
  }

  return flavorToSrcFileExtension[extensionFlavor] ?? 'js'
}

export function getExtensionRuntimeDependencies({
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

export function getFunctionRuntimeDependencies(templateLanguage: string): DependencyVersion[] {
  const dependencies: DependencyVersion[] = []
  if (templateLanguage === 'javascript') {
    dependencies.push({name: '@shopify/shopify_function', version: '0.0.3'}, {name: 'javy', version: '0.1.0'})
  }
  return dependencies
}

async function changeIndexFileExtension(extensionDirectory: string, fileExtension: SrcFileExtension) {
  const srcFilePaths = await glob(joinPath(extensionDirectory, 'src', '*'))
  const srcFileExensionsToChange = []

  for (const srcFilePath of srcFilePaths) {
    srcFileExensionsToChange.push(moveFile(srcFilePath, `${srcFilePath}.${fileExtension}`))
  }

  await Promise.all(srcFileExensionsToChange)
}

async function removeUnwantedTemplateFilesPerFlavor(extensionDirectory: string, extensionFlavor: ExtensionFlavorValue) {
  // tsconfig.json file is only needed in extension folder to inform the IDE
  // About the `react-jsx` tsconfig option, so IDE don't complain about missing react import
  if (extensionFlavor !== 'typescript-react') {
    await removeFile(joinPath(extensionDirectory, 'tsconfig.json'))
  }
}

async function functionExtensionInit(options: FunctionExtensionInitOptions) {
  const url = options.cloneUrl || options.specification.templateURL
  const specification = options.specification

  await inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = joinPath(tmpDir, 'download')
    const extensionFlavor = options.extensionFlavor
    const templateLanguage = getTemplateLanguage(extensionFlavor)
    const taskList = []

    if (templateLanguage === 'javascript') {
      taskList.push({
        title: 'Installing additional dependencies',
        task: async () => {
          const requiredDependencies = getFunctionRuntimeDependencies(templateLanguage)
          await addNPMDependenciesIfNeeded(requiredDependencies, {
            packageManager: options.app.packageManager,
            type: 'prod',
            directory: options.app.directory,
          })
        },
      })
    }

    taskList.push({
      title: `Generating ${specification.externalName} extension`,
      task: async () => {
        await mkdir(templateDownloadDir)
        await downloadGitRepository({
          repoUrl: url,
          destination: templateDownloadDir,
          shallow: true,
        })
        const origin = await ensureFunctionExtensionFlavorExists(specification, extensionFlavor, templateDownloadDir)

        await recursiveLiquidTemplateCopy(origin, options.extensionDirectory, {
          flavor: extensionFlavor,
          ...options,
        })

        if (templateLanguage === 'javascript') {
          const srcFileExtension = getSrcFileExtension(extensionFlavor)
          await changeIndexFileExtension(options.extensionDirectory, srcFileExtension)
        }

        const configYamlPath = joinPath(options.extensionDirectory, 'script.config.yml')
        if (await fileExists(configYamlPath)) {
          await removeFile(configYamlPath)
        }
      },
    })

    if (templateLanguage === 'javascript') {
      taskList.push({
        title: `Building ${specification.externalName} graphql types`,
        task: async () => {
          await buildGraphqlTypes(
            {directory: options.extensionDirectory, isJavaScript: true},
            {stdout: process.stdout, stderr: process.stderr},
          )
        },
      })
    }

    await renderTasks(taskList)
  })
}

async function ensureExtensionDirectoryExists({name, app}: {name: string; app: AppInterface}): Promise<string> {
  const hyphenizedName = hyphenate(name)
  const extensionDirectory = joinPath(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await fileExists(extensionDirectory)) {
    throw new AbortError(
      `\nA directory with this name (${hyphenizedName}) already exists.\nChoose a new name for your extension.`,
    )
  }
  await mkdir(extensionDirectory)
  return extensionDirectory
}

async function addResolutionOrOverrideIfNeeded(directory: string, extensionFlavor?: ExtensionFlavorValue) {
  if (extensionFlavor === 'typescript-react') {
    await addResolutionOrOverride(directory, {'@types/react': versions.reactTypes})
  }
}
