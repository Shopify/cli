import {fetchChannelSpecExport} from './fetch.js'
import {importChannelConfigJsonOutputSchema, type ImportedChannelConfig} from './types.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {
  CHANNEL_CONFIG_IDENTIFIER,
  CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY,
} from '../../models/extensions/specifications/channel.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, matchGlob, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {basename, dirname, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'

export const CHANNEL_SPEC_EXTENSION_DIRECTORY = joinPath('extensions', 'channel-config')
export const CHANNEL_SPEC_DIRECTORY = joinPath(
  CHANNEL_SPEC_EXTENSION_DIRECTORY,
  CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY,
)

const EXTENSION_CONFIG_FILENAME = 'shopify.extension.toml'
const EXTENSION_CONFIG_CONTENT = `name = "Channel config"\ntype = "${CHANNEL_CONFIG_IDENTIFIER}"\nhandle = "channel-config"\n`
const DEFAULT_EXTENSION_DIRECTORIES = ['extensions/*']

const FAILURE_MESSAGES: {[reason: string]: string} = {
  no_exportable_frozen_record: "This app doesn't have a channel spec that can be exported yet.",
  multiple_exportable_records: "This app has more than one channel spec, so it can't be exported automatically.",
  not_allowlisted: "This app isn't part of the channel spec export prototype yet.",
  contains_no_public_fields: "This app's channel spec has no public channel_config fields.",
  invalid_public_schema: "This app's channel spec doesn't match the public channel_config schema.",
}

interface ImportChannelConfigOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  force: boolean
}

/**
 * Imports the Shopify-authored channel spec for the linked app into the app's channel_config
 * extension, creating the extension if the app doesn't have one yet.
 */
export async function importChannelConfig(options: ImportChannelConfigOptions): Promise<ImportedChannelConfig> {
  const {app, remoteApp, developerPlatformClient, force} = options

  const result = await fetchChannelSpecExport({remoteApp, developerPlatformClient})

  if (!result.success) {
    const message = FAILURE_MESSAGES[result.reason]
    if (message) throw new AbortError(message)
    throw new AbortError(`The channel spec for this app could not be exported (reason: ${result.reason}).`)
  }

  const {extensionDirectory, createExtension} = resolveExtensionDirectory(app)

  // basename() so a filename with path separators can't escape the specifications directory
  const outputPath = resolvePath(extensionDirectory, CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY, basename(result.filename))
  if (!force && (await fileExists(outputPath))) {
    throw new AbortError(
      `A channel spec already exists at ${relativePath(app.directory, outputPath)}.`,
      'Re-run with `--force` to replace it.',
    )
  }

  const imported = importChannelConfigJsonOutputSchema.validate({
    status: 'success',
    handle: result.handle,
    filename: basename(result.filename),
    path: outputPath,
    toml: result.toml,
    warnings: result.warnings.map(({code, message}) => ({code, message})),
  })

  await mkdir(dirname(outputPath))
  if (createExtension) {
    await writeFile(joinPath(extensionDirectory, EXTENSION_CONFIG_FILENAME), EXTENSION_CONFIG_CONTENT)
  }
  await writeFile(outputPath, imported.toml)

  return {
    ...imported,
    extensionConfigurationPath: createExtension ? resolvePath(extensionDirectory, EXTENSION_CONFIG_FILENAME) : null,
  }
}

/**
 * Picks the extension directory the spec should be written to. Reuses the app's existing
 * channel_config extension if it has one; otherwise scaffolds a new one at
 * extensions/channel-config, as long as the app's extension_directories would pick it up.
 */
function resolveExtensionDirectory(app: AppLinkedInterface): {extensionDirectory: string; createExtension: boolean} {
  const existing = app.allExtensions.filter((extension) => extension.type === CHANNEL_CONFIG_IDENTIFIER)

  if (existing.length > 1) {
    const paths = existing.map((extension) => relativePath(app.directory, extension.directory)).join(', ')
    throw new AbortError(
      `This app has more than one ${CHANNEL_CONFIG_IDENTIFIER} extension (${paths}).`,
      'Only one is allowed. Remove the extras and try again.',
    )
  }

  if (existing.length === 1) {
    return {extensionDirectory: existing[0]!.directory, createExtension: false}
  }

  // The loader treats an empty extension_directories the same as an unset one (extensions/*).
  const configuredDirectories = app.configuration.extension_directories
  const extensionDirectories =
    configuredDirectories && configuredDirectories.length > 0 ? configuredDirectories : DEFAULT_EXTENSION_DIRECTORIES
  const wouldBeDiscovered = extensionDirectories.some((pattern) =>
    matchGlob(`${CHANNEL_SPEC_EXTENSION_DIRECTORY}/${EXTENSION_CONFIG_FILENAME}`, `${pattern}/*.extension.toml`),
  )
  if (!wouldBeDiscovered) {
    throw new AbortError(
      `Your shopify.app.toml only loads extensions from ${extensionDirectories.join(', ')}, so a new extension at ${CHANNEL_SPEC_EXTENSION_DIRECTORY} wouldn't be deployed.`,
      `Create a ${CHANNEL_CONFIG_IDENTIFIER} extension in one of those directories with a ${EXTENSION_CONFIG_FILENAME} like:\n\n${EXTENSION_CONFIG_CONTENT}\nthen re-run this command.`,
    )
  }

  const extensionDirectory = joinPath(app.directory, CHANNEL_SPEC_EXTENSION_DIRECTORY)
  const occupiedBy = app.allExtensions.find((extension) => extension.directory === extensionDirectory)
  if (occupiedBy) {
    throw new AbortError(
      `${CHANNEL_SPEC_EXTENSION_DIRECTORY} already contains a ${occupiedBy.type} extension.`,
      'Move that extension to another directory, then re-run this command.',
    )
  }

  return {extensionDirectory, createExtension: true}
}
