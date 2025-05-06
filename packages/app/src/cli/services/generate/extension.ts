import {configurationFileNames, versions} from '../../constants.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {buildGraphqlTypes, SHOPIFY_FUNCTION_NPM_PACKAGE_MAJOR_VERSION} from '../function/build.js'
import {GenerateExtensionContentOutput} from '../../prompts/generate/extension.js'
import {ExtensionFlavor, ExtensionTemplate} from '../../models/app/template.js'
import {ensureDownloadedExtensionFlavorExists, ensureExtensionDirectoryExists} from '../extensions/common.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {reloadApp} from '../../models/app/loader.js'
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
import {slugify} from '@shopify/cli-kit/common/string'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

export interface GenerateExtensionTemplateOptions {
  app: AppLinkedInterface
  cloneUrl?: string
  extensionChoices: GenerateExtensionContentOutput
  extensionTemplate: ExtensionTemplate
  developerPlatformClient: DeveloperPlatformClient

  // Override the default git clone behavior
  onGetTemplateRepository?: (url: string, destination: string) => Promise<void>
}

export type ExtensionFlavorValue =
  | 'vanilla-js'
  | 'preact'
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
    case 'preact':
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
  app: AppLinkedInterface
  type: string
  name: string
  extensionFlavor: ExtensionFlavor | undefined
  uid: string | undefined
  onGetTemplateRepository: (url: string, destination: string) => Promise<void>
}

export async function generateExtensionTemplate(
  options: GenerateExtensionTemplateOptions,
): Promise<GeneratedExtension> {
  const extensionName: string = options.extensionChoices.name
  const extensionFlavorValue = options.extensionChoices.flavor
  const extensionFlavor = options.extensionTemplate.supportedFlavors.find(
    (flavor) => flavor.value === extensionFlavorValue,
  )
  const directory = await ensureExtensionDirectoryExists({app: options.app, name: extensionName})
  const url = options.cloneUrl ?? options.extensionTemplate.url

  const uid = options.developerPlatformClient.supportsAtomicDeployments ? randomUUID() : undefined
  const initOptions: ExtensionInitOptions = {
    directory,
    url,
    app: options.app,
    type: options.extensionTemplate.type,
    name: extensionName,
    extensionFlavor,
    uid,
    onGetTemplateRepository:
      options.onGetTemplateRepository ??
      (async (url, destination) => {
        await downloadGitRepository({repoUrl: url, destination, shallow: true})
      }),
  }
  await extensionInit(initOptions)
  return {directory: relativizePath(directory), extensionTemplate: options.extensionTemplate}
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
    const lockFilePath = joinPath(options.directory, configurationFileNames.lockFile)
    await removeFile(lockFilePath)
  } catch (error) {
    await removeFile(options.directory)
    throw error
  }
}

async function themeExtensionInit({
  directory,
  url,
  type,
  name,
  extensionFlavor,
  uid,
  onGetTemplateRepository,
}: ExtensionInitOptions) {
  return inTemporaryDirectory(async (tmpDir) => {
    const templateDirectory = await downloadOrFindTemplateDirectory(
      url,
      extensionFlavor,
      tmpDir,
      onGetTemplateRepository,
    )
    await recursiveLiquidTemplateCopy(templateDirectory, directory, {name, type, uid})
  })
}

async function functionExtensionInit({
  directory,
  url,
  app,
  name,
  extensionFlavor,
  uid,
  onGetTemplateRepository,
}: ExtensionInitOptions) {
  const templateLanguage = getTemplateLanguage(extensionFlavor?.value)
  const taskList = []

  taskList.push({
    title: `Generating function extension`,
    task: async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const templateDirectory = await downloadOrFindTemplateDirectory(
          url,
          extensionFlavor,
          tmpDir,
          onGetTemplateRepository,
        )
        await recursiveLiquidTemplateCopy(templateDirectory, directory, {
          name,
          handle: slugify(name),
          flavor: extensionFlavor?.value,
          uid,
        })
      })

      if (templateLanguage === 'javascript') {
        const srcFileExtension = getSrcFileExtension(extensionFlavor?.value ?? 'rust')
        await changeIndexFileExtension(directory, srcFileExtension, '!(*.graphql)')
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
        await buildGraphqlTypes({directory, isJavaScript: true}, {stdout: process.stdout, stderr: process.stderr, app})
      },
    })
  }

  await renderTasks(taskList)
}

async function uiExtensionInit({
  directory,
  url,
  app,
  name,
  extensionFlavor,
  uid,
  onGetTemplateRepository,
}: ExtensionInitOptions) {
  const templateLanguage = getTemplateLanguage(extensionFlavor?.value)

  const tasks = [
    {
      title: `Generating extension`,
      task: async () => {
        const srcFileExtension = getSrcFileExtension(extensionFlavor?.value ?? 'vanilla-js')

        await inTemporaryDirectory(async (tmpDir) => {
          const templateDirectory = await downloadOrFindTemplateDirectory(
            url,
            extensionFlavor,
            tmpDir,
            onGetTemplateRepository,
          )
          await recursiveLiquidTemplateCopy(templateDirectory, directory, {
            srcFileExtension,
            name,
            handle: slugify(name),
            flavor: extensionFlavor?.value ?? '',
            uid,
          })
        })

        if (templateLanguage === 'javascript') {
          await changeIndexFileExtension(directory, srcFileExtension)
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await removeUnwantedTemplateFilesPerFlavor(directory, extensionFlavor!.value)
        }
      },
    },
    {
      title: 'Installing dependencies',
      task: async () => {
        const packageManager = app.packageManager
        if (app.usesWorkspaces) {
          // Only install dependencies if the extension is javascript
          if (getTemplateLanguage(extensionFlavor?.value) === 'javascript') {
            await installNodeModules({
              packageManager,
              directory: app.directory,
            })
          }
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

  tasks.push({
    title: 'Update shared type definition',
    task: async () => {
      await reloadApp(app)
    },
  })

  await renderTasks(tasks)
}

type SrcFileExtension = 'ts' | 'tsx' | 'js' | 'jsx' | 'rs' | 'wasm' | 'liquid' | ''
function getSrcFileExtension(extensionFlavor: ExtensionFlavorValue): SrcFileExtension {
  const flavorToSrcFileExtension: {[key in ExtensionFlavorValue]: SrcFileExtension} = {
    'vanilla-js': 'js',
    preact: 'jsx',
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
    dependencies.push({
      name: '@shopify/shopify_function',
      version: `~${SHOPIFY_FUNCTION_NPM_PACKAGE_MAJOR_VERSION}.0.0`,
    })
  }
  return dependencies
}

async function changeIndexFileExtension(extensionDirectory: string, fileExtension: SrcFileExtension, renameGlob = '*') {
  const srcFilePaths = await glob(joinPath(extensionDirectory, 'src', renameGlob))
  const srcFileExensionsToChange = []

  for (const srcFilePath of srcFilePaths) {
    srcFileExensionsToChange.push(moveFile(srcFilePath, `${srcFilePath}.${fileExtension}`))
  }

  await Promise.all(srcFileExensionsToChange)
}

async function removeUnwantedTemplateFilesPerFlavor(extensionDirectory: string, extensionFlavor: ExtensionFlavorValue) {
  // Preact needs the tsconfig.json to set the `"jsxImportSource": "preact"` so it can properly build
  if (extensionFlavor === 'preact') {
    return
  }

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
  onGetTemplateRepository: (url: string, destination: string) => Promise<void>,
) {
  const templateDownloadDir = joinPath(tmpDir, 'download')
  await mkdir(templateDownloadDir)
  await onGetTemplateRepository(url, templateDownloadDir)
  return ensureDownloadedExtensionFlavorExists(extensionFlavor, templateDownloadDir)
}
