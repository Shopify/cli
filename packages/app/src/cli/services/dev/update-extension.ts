import {
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../../api/graphql/partners/generated/update-draft.js'
import {AppConfiguration} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {themeExtensionConfig} from '../deploy/theme-extension-config.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {dirname, isAbsolutePath, isSubpath, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

interface UpdateExtensionDraftOptions {
  extension: ExtensionInstance
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
  appConfiguration: AppConfiguration
  bundlePath: string
}

async function getSerializedScriptOutputPath(extension: ExtensionInstance, bundlePath: string) {
  const fallbackOutputPath = extension.getOutputPathForDirectory(bundlePath)
  if (extension.type !== 'ui_extension') return fallbackOutputPath

  const buildDirectory = dirname(fallbackOutputPath)
  const manifestMainPath = await getManifestMainPath(extension, buildDirectory)

  const manifestOutputPath = manifestMainPath
    ? getSafeManifestOutputPath(buildDirectory, manifestMainPath)
    : undefined

  return manifestOutputPath ?? fallbackOutputPath
}

async function getManifestMainPath(extension: ExtensionInstance, buildDirectory: string): Promise<string | undefined> {
  const manifest = await readBundleManifest(buildDirectory)
  if (!manifest) return undefined

  const singleTarget = getSingleConfiguredTarget(extension.configuration as Record<string, unknown>)
  if (singleTarget) {
    const targetMainPath = getManifestEntryMainPath(manifest[singleTarget])
    if (targetMainPath) return targetMainPath
  }

  const mainPaths = Object.keys(manifest)
    .sort()
    .map((target) => getManifestEntryMainPath(manifest[target]))
    .filter((mainPath): mainPath is string => mainPath !== undefined)

  return mainPaths[0]
}

async function readBundleManifest(buildDirectory: string): Promise<Record<string, unknown> | undefined> {
  try {
    const content = await readFile(joinPath(buildDirectory, 'manifest.json'))
    const parsedManifest = JSON.parse(content)
    return isRecord(parsedManifest) ? parsedManifest : undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

function getSingleConfiguredTarget(configuration: Record<string, unknown>) {
  const targets = [...getTargets(configuration.extension_points), ...getTargets(configuration.targeting)]
  const uniqueTargets = [...new Set(targets)]

  return uniqueTargets.length === 1 ? uniqueTargets[0] : undefined
}

function getTargets(targeting: unknown) {
  if (!Array.isArray(targeting)) return []

  return targeting.flatMap((target) => {
    if (!isRecord(target) || typeof target.target !== 'string') return []
    return target.target
  })
}

function getManifestEntryMainPath(entry: unknown) {
  if (!isRecord(entry) || typeof entry.main !== 'string' || entry.main.length === 0) return undefined
  return entry.main
}

function getSafeManifestOutputPath(buildDirectory: string, manifestMainPath: string) {
  if (isAbsolutePath(manifestMainPath)) return undefined

  const outputPath = joinPath(buildDirectory, manifestMainPath)
  const resolvedBuildDirectory = resolvePath(buildDirectory)
  const resolvedOutputPath = resolvePath(outputPath)

  return isSubpath(resolvedBuildDirectory, resolvedOutputPath) ? outputPath : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function updateExtensionDraft({
  extension,
  developerPlatformClient,
  apiKey,
  registrationId,
  stdout,
  stderr,
  appConfiguration,
  bundlePath,
}: UpdateExtensionDraftOptions) {
  let encodedFile: string | undefined
  if (extension.features.includes('esbuild')) {
    const outputPath = await getSerializedScriptOutputPath(extension, bundlePath)
    const content = await readFile(outputPath)
    if (!content) return
    encodedFile = Buffer.from(content).toString('base64')
  }

  let config
  if (extension.isThemeExtension) {
    // When updating just the theme extension draft, upload the files as part of the config.
    config = await themeExtensionConfig(extension)
  } else {
    config = (await extension.deployConfig({apiKey, appConfiguration})) ?? {}
  }

  const draftableConfig: {[key: string]: unknown} = {
    ...config,
    serialized_script: encodedFile,
  }
  if (extension.isFunctionExtension) {
    // For function drafts we need to use the `extension.outputPath` instead of `bundlePath`
    // The wasm in the bundle path is encoded in base64.
    const compiledFiles = await readFile(extension.outputPath, {encoding: 'base64'})
    draftableConfig.uploaded_files = {'dist/index.wasm': compiledFiles}
  }
  const extensionInput: ExtensionUpdateDraftMutationVariables = {
    apiKey,
    config: JSON.stringify(draftableConfig),
    handle: extension.handle,
    context: extension.contextValue,
    registrationId,
  }

  let mutationResult: ExtensionUpdateDraftMutation | undefined
  let errors: {message: string}[] = []
  try {
    mutationResult = await developerPlatformClient.updateExtension(extensionInput)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error: unknown) {
    errors = [{message: 'Unknown error'}]

    if (error && typeof error === 'object') {
      const errorObj = error as {errors?: {message: string}[]; message?: string}
      if (errorObj.errors?.length) {
        errors = errorObj.errors
      } else if (errorObj.message) {
        errors = [{message: errorObj.message}]
      }
    } else if (typeof error === 'string') {
      errors = [{message: error}]
    }
  }
  const userErrors = mutationResult?.extensionUpdateDraft?.userErrors
  if (userErrors?.length) {
    errors.push(...userErrors)
  }
  if (errors.length > 0) {
    const errorMessages = errors.map((error: {message: string}) => error.message).join(', ')
    stderr.write(`${extension.draftMessages.errorMessage}: ${errorMessages}`)
  } else {
    const draftUpdateSuccesMessage = extension.draftMessages.successMessage
    if (draftUpdateSuccesMessage) outputInfo(draftUpdateSuccesMessage, stdout)
  }
}
