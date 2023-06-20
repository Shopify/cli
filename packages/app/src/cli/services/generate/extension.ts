import {versions} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {buildGraphqlTypes} from '../function/build.js'
import {GenerateExtensionContentOutput} from '../../prompts/generate/extension.js'
import {ExtensionFlavor, ExtensionTemplate} from '../../models/app/template.js'
import {
  ensureDownloadedExtensionFlavorExists,
  ensureExtensionDirectoryExists,
  ensureLocalExtensionFlavorExists,
} from '../extensions/common.js'
import {
  addNPMDependenciesIfNeeded,
  addResolutionOrOverride,
  DependencyVersion,
  installNodeModules,
  readAndParsePackageJson,
} from '@shopify/cli-kit/node/node-package-manager'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {fileExists, inTemporaryDirectory, mkdir, moveFile, removeFile, glob} from '@shopify/cli-kit/node/fs'
import {joinPath, relativizePath} from '@shopify/cli-kit/node/path'

export interface GenerateExtensionTemplateOptions {
  app: AppInterface
  cloneUrl?: string
  extensionChoices: GenerateExtensionContentOutput[]
  extensionTemplate: ExtensionTemplate
}

export type ExtensionFlavorValue =
  | 'vanilla-js'
  | 'react'
  | 'typescript'
  | 'typescript-react'
  | 'rust'
  | 'wasm'
  | 'liquid'
  | 'config-only'

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
  extensionTemplate: ExtensionTemplate
}

interface ExtensionInitOptions {
  directory: string
  url: string
  app: AppInterface
  type: string
  name: string
  extensionFlavor: ExtensionFlavor | undefined
}

export async function generateExtensionTemplate(
  options: GenerateExtensionTemplateOptions,
): Promise<GeneratedExtension[]> {
  return Promise.all(
    options.extensionTemplate.types.flatMap(async (spec, index) => {
      const extensionName: string = options.extensionChoices[index]!.name
      const extensionFlavorValue = options.extensionChoices[index]?.flavor
      const extensionFlavor = spec.supportedFlavors.find((flavor) => flavor.value === extensionFlavorValue)
      const directory = await ensureExtensionDirectoryExists({app: options.app, name: extensionName})
      const url = options.cloneUrl || spec.url
      const initOptions: ExtensionInitOptions = {
        directory,
        url,
        app: options.app,
        type: spec.type,
        name: extensionName,
        extensionFlavor,
      }
      await extensionInit(initOptions)
      return {directory: relativizePath(directory), extensionTemplate: options.extensionTemplate}
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

async function themeExtensionInit({directory, url, type, name, extensionFlavor}: ExtensionInitOptions) {
  return inTemporaryDirectory(async (tmpDir) => {
    const templateDirectory = await downloadOrFindTemplateDirectory(url, extensionFlavor, tmpDir)
    await recursiveLiquidTemplateCopy(templateDirectory, directory, {name, type})
  })
}

async function functionExtensionInit({directory, url, app, name, extensionFlavor}: ExtensionInitOptions) {
  const templateLanguage = getTemplateLanguage(extensionFlavor?.value)
  const taskList = []

  taskList.push({
    title: `Generating function extension`,
    task: async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const templateDirectory = await downloadOrFindTemplateDirectory(url, extensionFlavor, tmpDir)
        await recursiveLiquidTemplateCopy(templateDirectory, directory, {name, flavor: extensionFlavor?.value})
      })

      if (templateLanguage === 'javascript') {
        const srcFileExtension = getSrcFileExtension(extensionFlavor?.value || 'rust')
        await changeIndexFileExtension(directory, srcFileExtension)
      }
    },
  })

  if (templateLanguage === 'javascript') {
    taskList.push({
      title: 'Installing additional dependencies',
      task: async () => {
        // We need to run `npm install` once to setup the workspace correctly
        if (app.usesWorkspaces && app.packageManager === 'npm') {
          await installNodeModules({packageManager: 'npm', directory: app.directory})
        }

        const requiredDependencies = getFunctionRuntimeDependencies(templateLanguage)
        await addNPMDependenciesIfNeeded(requiredDependencies, {
          packageManager: app.packageManager,
          type: 'prod',
          directory: app.usesWorkspaces ? directory : app.directory,
        })
      },
    })
  }

  if (templateLanguage === 'javascript') {
    taskList.push({
      title: `Building GraphQL types`,
      task: async () => {
        await buildGraphqlTypes({directory, isJavaScript: true}, {stdout: process.stdout, stderr: process.stderr})
      },
    })
  }

  await renderTasks(taskList)
}

async function uiExtensionInit({directory, url, app, name, extensionFlavor}: ExtensionInitOptions) {
  const templateLanguage = getTemplateLanguage(extensionFlavor?.value)

  const tasks = [
    {
      title: `Generating UI extension`,
      task: async () => {
        const srcFileExtension = getSrcFileExtension(extensionFlavor?.value ?? 'vanilla-js')

        await inTemporaryDirectory(async (tmpDir) => {
          const templateDirectory = await downloadOrFindTemplateDirectory(url, extensionFlavor, tmpDir)
          await recursiveLiquidTemplateCopy(templateDirectory, directory, {
            srcFileExtension,
            name,
            flavor: extensionFlavor?.value ?? '',
          })
        })

        if (templateLanguage === 'javascript') {
          await changeIndexFileExtension(directory, srcFileExtension)
          await removeUnwantedTemplateFilesPerFlavor(directory, extensionFlavor!.value)
        }
      },
    },
    {
      title: 'Installing dependencies',
      task: async () => {
        const packageManager = app.packageManager
        if (app.usesWorkspaces) {
          // NPM doesn't resolve the react dependency properly with extensions depending on React 17 and cli-kit on React 18
          if (extensionFlavor?.value.includes('react') && packageManager === 'npm') {
            await addNPMDependenciesIfNeeded([{name: 'react', version: versions.react}], {
              packageManager,
              type: 'prod',
              directory: app.directory,
            })
          }
          await installNodeModules({
            packageManager,
            directory: app.directory,
          })
        } else {
          await addResolutionOrOverrideIfNeeded(app.directory, extensionFlavor?.value)
          const extensionPackageJsonPath = joinPath(directory, 'package.json')
          const requiredDependencies = await getProdDependencies(extensionPackageJsonPath)
          await addNPMDependenciesIfNeeded(requiredDependencies, {
            packageManager,
            type: 'prod',
            directory: app.directory,
          })
          await removeFile(extensionPackageJsonPath)
        }
      },
    },
  ]
  await renderTasks(tasks)
}

type SrcFileExtension = 'ts' | 'tsx' | 'js' | 'jsx' | 'rs' | 'wasm' | 'liquid' | ''
function getSrcFileExtension(extensionFlavor: ExtensionFlavorValue): SrcFileExtension {
  const flavorToSrcFileExtension: {[key in ExtensionFlavorValue]: SrcFileExtension} = {
    'vanilla-js': 'js',
    react: 'jsx',
    typescript: 'ts',
    'typescript-react': 'tsx',
    rust: 'rs',
    wasm: 'wasm',
    liquid: 'liquid',
    'config-only': '',
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

async function addResolutionOrOverrideIfNeeded(directory: string, extensionFlavor: ExtensionFlavorValue | undefined) {
  if (extensionFlavor === 'typescript-react') {
    await addResolutionOrOverride(directory, {'@types/react': versions.reactTypes})
  }
}

async function getProdDependencies(packageJsonPath: string): Promise<DependencyVersion[]> {
  if (!(await fileExists(packageJsonPath))) return []

  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  return Object.entries(packageJsonContent?.dependencies ?? {}).map(([name, version]) => ({name, version}))
}

async function downloadOrFindTemplateDirectory(
  url: string,
  extensionFlavor: ExtensionFlavor | undefined,
  tmpDir: string,
) {
  if (url === 'https://github.com/Shopify/cli') {
    return ensureLocalExtensionFlavorExists(extensionFlavor)
  } else {
    const templateDownloadDir = joinPath(tmpDir, 'download')
    await mkdir(templateDownloadDir)
    await downloadGitRepository({
      repoUrl: url,
      destination: templateDownloadDir,
      shallow: true,
    })
    return ensureDownloadedExtensionFlavorExists(extensionFlavor, templateDownloadDir)
  }
}
