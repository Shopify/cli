import {fetchChannelSpecExport} from './fetch.js'
import {importChannelConfigJsonOutputSchema} from './types.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import {basename, dirname, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export const CHANNEL_SPEC_EXTENSION_DIRECTORY = joinPath('extensions', 'channel-config')
export const CHANNEL_SPEC_DIRECTORY = joinPath(CHANNEL_SPEC_EXTENSION_DIRECTORY, 'specifications')

const EXTENSION_CONFIG_FILENAME = 'shopify.extension.toml'
// Without this file the app loader won't pick up the extension and the spec won't be deployed
const EXTENSION_CONFIG_CONTENT = 'name = "Channel config"\ntype = "channel_config"\nhandle = "channel-config"\n'
const CHANNEL_CONFIG_EXTENSION_TYPE = 'channel_config'

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
  json: boolean
}

/**
 * Imports the Shopify-authored channel spec for the linked app into
 * extensions/channel-config/specifications/<handle>.toml.
 */
export async function importChannelConfig(options: ImportChannelConfigOptions): Promise<void> {
  const {app, remoteApp, developerPlatformClient, force, json} = options

  const result = await fetchChannelSpecExport({remoteApp, developerPlatformClient})

  if (!result.success) {
    const message = FAILURE_MESSAGES[result.reason]
    if (message) throw new AbortError(message)
    throw new AbortError(`The channel spec for this app could not be exported (reason: ${result.reason}).`)
  }

  // basename() so a filename with path separators can't escape the specifications directory
  const outputPath = joinPath(app.directory, CHANNEL_SPEC_DIRECTORY, basename(result.filename))
  if (!force && (await fileExists(outputPath))) {
    throw new AbortError(
      `A channel spec already exists at ${relativePath(app.directory, outputPath)}.`,
      'Re-run with `--force` to replace it.',
    )
  }

  // Check the extension config first so we don't leave a stray spec file behind on abort
  await mkdir(dirname(outputPath))
  const createdExtensionConfig = await ensureExtensionConfig(app.directory)
  await writeFile(outputPath, result.toml)

  if (json) {
    outputResult(
      importChannelConfigJsonOutputSchema.encode({
        handle: result.handle,
        filename: basename(result.filename),
        path: relativePath(app.directory, outputPath),
        toml: result.toml,
        warnings: result.warnings,
      }),
    )
    return
  }

  result.warnings.forEach((warning) => renderWarning({body: warning.message}))

  renderSuccess({
    headline: ['Imported the channel spec for', {userInput: remoteApp.title}, {char: '.'}],
    body: [
      'The spec was written to',
      {filePath: relativePath(app.directory, outputPath)},
      {char: '.'},
      ...(createdExtensionConfig
        ? [
            'Also created',
            {filePath: joinPath(CHANNEL_SPEC_EXTENSION_DIRECTORY, EXTENSION_CONFIG_FILENAME)},
            'so the spec is included when your app is deployed.',
          ]
        : []),
    ],
    nextSteps: [
      'Review the generated spec and make any changes your channel needs.',
      ['Run', {command: 'shopify app dev'}, 'to try the spec on a development store before releasing it.'],
      ['Run', {command: 'shopify app deploy'}, 'to deploy the spec as part of your app.'],
    ],
  })
}

/**
 * Creates shopify.extension.toml if missing. If one exists with a different extension type the
 * spec would never be deployed, so abort rather than write it.
 *
 * @returns true if the file was created.
 */
async function ensureExtensionConfig(appDirectory: string): Promise<boolean> {
  const extensionConfigPath = joinPath(appDirectory, CHANNEL_SPEC_EXTENSION_DIRECTORY, EXTENSION_CONFIG_FILENAME)
  if (!(await fileExists(extensionConfigPath))) {
    await writeFile(extensionConfigPath, EXTENSION_CONFIG_CONTENT)
    return true
  }

  const relativeConfigPath = joinPath(CHANNEL_SPEC_EXTENSION_DIRECTORY, EXTENSION_CONFIG_FILENAME)
  let existingType: unknown
  try {
    const decoded = decodeToml(await readFile(extensionConfigPath)) as {[key: string]: unknown}
    existingType = decoded.type
  } catch {
    throw new AbortError(`Couldn't parse the existing ${relativeConfigPath}.`, 'Fix or remove the file and try again.')
  }

  if (existingType !== CHANNEL_CONFIG_EXTENSION_TYPE) {
    const describedType = typeof existingType === 'string' ? `"${existingType}"` : 'an unknown type'
    throw new AbortError(
      `${relativeConfigPath} already defines an extension of type ${describedType}.`,
      `Move that extension to another directory or change its type to "${CHANNEL_CONFIG_EXTENSION_TYPE}", then try again.`,
    )
  }

  return false
}
