import {fetchChannelSpecExport, ChannelSpecExportWarning} from './fetch.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export const CHANNEL_SPEC_DIRECTORY = joinPath('extensions', 'channel-config', 'specifications')

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

export interface GenerateChannelSpecOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  stdout: boolean
  overwrite: boolean
}

/**
 * Generates a deployable channel_config spec TOML file for the app.
 *
 * On success the TOML is either printed to stdout (`--stdout`) or written to
 * `extensions/channel-config/specifications/<handle>.toml` inside the app directory. Warnings
 * returned by the backend are rendered out-of-band and are never written into the TOML file.
 * This command never deploys; the partner reviews the generated file and runs `shopify app deploy`.
 */
export async function generateChannelSpec(options: GenerateChannelSpecOptions): Promise<void> {
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

  const outputPath = joinPath(app.directory, CHANNEL_SPEC_DIRECTORY, result.filename)
  if (!overwrite && (await fileExists(outputPath))) {
    throw new AbortError(
      `A channel spec already exists at ${relativePath(app.directory, outputPath)}.`,
      'Re-run with `--overwrite` to replace it.',
    )
  }

  await mkdir(dirname(outputPath))
  await writeFile(outputPath, result.toml)

  result.warnings.forEach((warning) => renderExportWarning(warning))

  renderSuccess({
    headline: ['Generated a channel spec for', {userInput: remoteApp.title}, {char: '.'}],
    body: ['The spec was written to', {filePath: relativePath(app.directory, outputPath)}, {char: '.'}],
    nextSteps: [
      'Review the generated spec before deploying it.',
      ['Run', {command: 'shopify app deploy'}, 'to deploy the spec as part of your app.'],
    ],
  })
}

function renderExportWarning(warning: ChannelSpecExportWarning): void {
  renderWarning({body: warning.message})
}
