import {versions} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {buildGraphqlTypes} from '../function/build.js'
import {GenerateExtensionContentOutput} from '../../prompts/generate/extension.js'
import {ExtensionFlavor} from '../../models/app/extensions.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {
  ensureDownloadedExtensionFlavorExists,
  ensureExtensionDirectoryExists,
  ensureLocalExtensionFlavorExists,
} from '../extensions/common.js'
import {
  addNPMDependenciesIfNeeded,
  addResolutionOrOverride,
  DependencyVersion,
  readAndParsePackageJson,
} from '@shopify/cli-kit/node/node-package-manager'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {fileExists, inTemporaryDirectory, mkdir, moveFile, removeFile, glob, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, relativizePath} from '@shopify/cli-kit/node/path'
import {BugError} from '@shopify/cli-kit/node/error'
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

export interface GenerateExtensionTemplateOptions {
  app: AppInterface
  cloneUrl?: string
  extensionChoices: GenerateExtensionContentOutput[]
  specification: TemplateSpecification
}

export type ExtensionFlavorValue = 'vanilla-js' | 'react' | 'typescript' | 'typescript-react' | 'rust' | 'wasm'

export type TemplateLanguage = 'javascript' | 'rust' | 'wasm' | undefined
function getTemplateLanguage(flavor: ExtensionFlavorValue | undefined): TemplateLanguage {
  switch (flavor) {
    case 'vanilla-js':
    case 'react':
    case 'typescript':
    case 'typescript-react':
      return 'javascript'
    case 'rust':
    case 'wasm':
      return flavor
    default:
      return undefined
  }
}

export interface GeneratedExtension {
  directory: string
  specification: TemplateSpecification
}

interface ExtensionInitOptions {
  type: string
  name: string
  directory: string
  url: string
  extensionFlavor: ExtensionFlavor | undefined
  app: AppInterface
}

export async function generateExtensionTemplate(
  options: GenerateExtensionTemplateOptions,
): Promise<GeneratedExtension[]> {
  return Promise.all(
    options.specification.types.flatMap(async (spec, index) => {
      const extensionName: string = options.extensionChoices[index]!.name
      const extensionFlavorValue = options.extensionChoices[index]?.flavor
      const directory = await ensureExtensionDirectoryExists({app: options.app, name: extensionName})
      const extensionFlavor = spec.supportedFlavors.find((flavor) => flavor.value === extensionFlavorValue)
      const initOptions: ExtensionInitOptions = {
        type: spec.type,
        name: extensionName,
        directory,
        url: options.cloneUrl || spec.url,
        extensionFlavor,
        app: options.app,
      }
      await extensionInit(initOptions)
      return {directory: relativizePath(directory), specification: options.specification}
    }),
  )
}

async function extensionInit(options: ExtensionInitOptions) {
  try {
    switch (options.type) {
      case 'theme':
        await themeExtensionInit(options)
        break
      case 'function':
        await functionExtensionInit(options)
        break
      default:
        await uiExtensionInit(options)
        break
    }
  } catch (error) {
    await removeFile(options.directory)
    throw error
  }
}

async function themeExtensionInit({type, name, directory}: ExtensionInitOptions) {
  const templatePath = await getTemplatePath('theme-extension')
  await recursiveLiquidTemplateCopy(templatePath, directory, {name, type})
}

async function uiExtensionInit({name, extensionFlavor, directory, app, url}: ExtensionInitOptions) {
  const tasks = [
    {
      title: `Generating UI extension`,
      task: async () => {
        await inTemporaryDirectory(async (tmpDir) => {
          let templateDirectory = ''
          const srcFileExtension = getSrcFileExtension(extensionFlavor?.value ?? 'vanilla-js')
          if (url === 'https://github.com/Shopify/cli') {
            templateDirectory = await ensureLocalExtensionFlavorExists(extensionFlavor)
          } else {
            const templateDownloadDir = joinPath(tmpDir, 'download')
            await mkdir(templateDownloadDir)
            await downloadGitRepository({
              repoUrl: url,
              destination: templateDownloadDir,
              shallow: true,
            })
            templateDirectory = await ensureDownloadedExtensionFlavorExists(extensionFlavor, templateDownloadDir)
          }

          await recursiveLiquidTemplateCopy(templateDirectory, directory, {
            srcFileExtension,
            name,
          })

          if (extensionFlavor) {
            await changeIndexFileExtension(directory, srcFileExtension)
            await removeUnwantedTemplateFilesPerFlavor(directory, extensionFlavor.value)
          }
        })
      },
    },
    {
      title: 'Installing dependencies',
      task: async () => {
        await addResolutionOrOverrideIfNeeded(app.directory, extensionFlavor?.value)
        const extensionPackageJsonPath = joinPath(directory, 'package.json')
        const requiredDependencies = await getProdDependencies(extensionPackageJsonPath)
        await addNPMDependenciesIfNeeded(requiredDependencies, {
          packageManager: app.packageManager,
          type: 'prod',
          directory: app.directory,
        })
        await removeFile(extensionPackageJsonPath)
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

async function functionExtensionInit({name, extensionFlavor, url, directory, app}: ExtensionInitOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = joinPath(tmpDir, 'download')
    const templateLanguage = getTemplateLanguage(extensionFlavor?.value)
    const taskList = []

    if (templateLanguage === 'javascript') {
      taskList.push({
        title: 'Installing additional dependencies',
        task: async () => {
          const requiredDependencies = getFunctionRuntimeDependencies(templateLanguage)
          await addNPMDependenciesIfNeeded(requiredDependencies, {
            packageManager: app.packageManager,
            type: 'prod',
            directory: app.directory,
          })
        },
      })
    }

    taskList.push({
      title: `Generating function extension`,
      task: async () => {
        await mkdir(templateDownloadDir)
        await downloadGitRepository({
          repoUrl: url,
          destination: templateDownloadDir,
          shallow: true,
        })
        const origin = await ensureDownloadedExtensionFlavorExists(extensionFlavor, templateDownloadDir)
        await recursiveLiquidTemplateCopy(origin, directory, {name})

        if (templateLanguage === 'javascript') {
          const srcFileExtension = getSrcFileExtension(extensionFlavor?.value || 'rust')
          await changeIndexFileExtension(directory, srcFileExtension)
        }

        const configYamlPath = joinPath(directory, 'script.config.yml')
        if (await fileExists(configYamlPath)) {
          await removeFile(configYamlPath)
        }
      },
    })

    if (templateLanguage === 'javascript') {
      taskList.push({
        title: `Building GraphQL types`,
        task: async () => {
          await buildGraphqlTypes({directory, isJavaScript: true}, {stdout: process.stdout, stderr: process.stderr})
        },
      })
    }

    await renderTasks(taskList)
  })
}

async function addResolutionOrOverrideIfNeeded(directory: string, extensionFlavor?: ExtensionFlavorValue) {
  if (extensionFlavor === 'typescript-react') {
    await addResolutionOrOverride(directory, {'@types/react': versions.reactTypes})
  }
}

async function getProdDependencies(packageJsonPath: string): Promise<DependencyVersion[]> {
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  return Object.entries(packageJsonContent?.dependencies ?? {}).map(([name, version]) => ({name, version}))
}
