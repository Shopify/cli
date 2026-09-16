import {fetchChannelSpecExport} from './fetch.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {basename, dirname, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export const CHANNEL_SPEC_EXTENSION_DIRECTORY = joinPath('extensions', 'channel-config')
export const CHANNEL_SPEC_DIRECTORY = joinPath(CHANNEL_SPEC_EXTENSION_DIRECTORY, 'specifications')

const EXTENSION_CONFIG_FILENAME = 'shopify.extension.toml'
// Minimal extension scaffold: the app loader only discovers extensions through *.extension.toml
// files, and the channel_config deploy step copies `specifications/` relative to the extension
// directory. Without this file, `shopify app deploy` would silently exclude the imported spec.
const EXTENSION_CONFIG_CONTENT = 'name = "Channel config"\ntype = "channel_config"\nhandle = "channel-config"\n'

const FAILURE_MESSAGES: {[reason: string]: string} = {
  no_exportable_frozen_record:
    'No deployable channel spec is available for this app yet.\n\n' +
    "The Shopify-authored default can't currently be exported to the public channel_config schema.",
  multiple_exportable_records:
    "This app has more than one Shopify-authored channel spec, so a single spec can't be exported automatically.",
  not_allowlisted: "This app isn't part of the channel spec export prototype yet.",
  contains_no_public_fields:
    'The Shopify-authored default for this app contains no fields that are part of the public channel_config schema.',
  invalid_public_schema:
    'The Shopify-authored default for this app could not be projected into a valid public channel_config spec.',
}

interface ImportChannelConfigOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  stdout: boolean
  overwrite: boolean
}

/**
 * Imports the Shopify-authored default channel spec as a deployable channel_config TOML file.
 *
 * On success the TOML is either printed to stdout (`--stdout`) or written to
 * `extensions/channel-config/specifications/<handle>.toml` inside the app directory. Warnings
 * returned by the backend are rendered out-of-band and are never written into the TOML file.
 * This command never deploys; the partner reviews the generated file and runs `shopify app deploy`.
 */
export async function importChannelConfig(options: ImportChannelConfigOptions): Promise<void> {
  const {app, remoteApp, developerPlatformClient, stdout, overwrite} = options

  const result = await fetchChannelSpecExport({remoteApp, developerPlatformClient})

  if (!result.success) {
    const message = FAILURE_MESSAGES[result.reason]
    if (message) throw new AbortError(message)
    throw new AbortError(`The channel spec for this app could not be exported (reason: ${result.reason}).`)
  }

  if (stdout) {
    // Warnings go to stderr so stdout carries only the TOML and stays pipeable.
    result.warnings.forEach((warning) => outputWarn(warning.message))
    outputResult(result.toml)
    return
  }

  // basename() confines the write to the specifications directory even if the backend ever
  // returned a filename containing path separators.
  const outputPath = joinPath(app.directory, CHANNEL_SPEC_DIRECTORY, basename(result.filename))
  if (!overwrite && (await fileExists(outputPath))) {
    throw new AbortError(
      `A channel spec already exists at ${relativePath(app.directory, outputPath)}.`,
      'Re-run with `--overwrite` to replace it.',
    )
  }

  await mkdir(dirname(outputPath))
  await writeFile(outputPath, result.toml)
  const createdExtensionConfig = await ensureExtensionConfig(app.directory)

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
      'Review the generated spec before deploying it.',
      ['Run', {command: 'shopify app deploy'}, 'to deploy the spec as part of your app.'],
    ],
  })
}

/**
 * Ensures the channel-config extension has a `shopify.extension.toml`, without which the app
 * loader would not discover the extension and the imported spec would never reach a deploy bundle.
 *
 * @returns true when the file was created, false when one already existed.
 */
async function ensureExtensionConfig(appDirectory: string): Promise<boolean> {
  const extensionConfigPath = joinPath(appDirectory, CHANNEL_SPEC_EXTENSION_DIRECTORY, EXTENSION_CONFIG_FILENAME)
  if (await fileExists(extensionConfigPath)) return false
  await writeFile(extensionConfigPath, EXTENSION_CONFIG_CONTENT)
  return true
}
