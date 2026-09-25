import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

interface ChannelSpecExportWarning {
  code: string
  message: string
}

type ChannelSpecExportResult =
  | {
      success: true
      handle: string
      filename: string
      toml: string
      warnings: ChannelSpecExportWarning[]
    }
  | {
      success: false
      reason: string
    }

interface FetchChannelSpecExportOptions {
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
}

/**
 * Fetches the channel spec export for an app. The backend generates and validates the TOML,
 * so we don't transform it here.
 */
export async function fetchChannelSpecExport({
  remoteApp,
  developerPlatformClient,
}: FetchChannelSpecExportOptions): Promise<ChannelSpecExportResult> {
  const response = await developerPlatformClient.channelSpecExport(remoteApp)

  if (response.status === 404) {
    // Export failures come back as 422, so a 404 means the endpoint or app isn't available
    throw new AbortError(
      'The channel spec export endpoint is not available for this app.',
      'Check that the app and organization are correct.',
    )
  }

  const decoded = response.body
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
    throw new AbortError(`Failed to fetch the channel spec export: unexpected response (status ${response.status}).`)
  }
  const payload = decoded as {[key: string]: unknown}

  // Server rejected this CLI version
  if (response.status === 426) {
    const reason =
      typeof payload.reason === 'string' ? payload.reason : 'This version of the Shopify CLI is no longer supported.'
    throw new AbortError(`Failed to fetch the channel spec export: ${reason}`, 'Upgrade the Shopify CLI and try again.')
  }

  if (response.status === 422) {
    const reason = typeof payload.reason === 'string' ? payload.reason : `http_${response.status}`
    return {success: false, reason}
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AbortError(
        `Failed to fetch the channel spec export: authentication failed (status ${response.status}).`,
        'Run `shopify auth logout` and try again.',
      )
    }
    throw new AbortError(
      `Failed to fetch the channel spec export: the server responded with status ${response.status}.`,
      'Try again in a moment.',
    )
  }

  const {handle, filename, toml, warnings} = payload
  if (typeof handle !== 'string' || typeof filename !== 'string' || typeof toml !== 'string') {
    throw new AbortError('Failed to fetch the channel spec export: the response was missing required fields.')
  }

  return {
    success: true,
    handle,
    filename,
    toml,
    warnings: parseWarnings(warnings),
  }
}

function parseWarnings(warnings: unknown): ChannelSpecExportWarning[] {
  if (!Array.isArray(warnings)) return []
  return warnings.flatMap((warning) => {
    if (
      warning &&
      typeof warning === 'object' &&
      typeof (warning as {code?: unknown}).code === 'string' &&
      typeof (warning as {message?: unknown}).message === 'string'
    ) {
      return [warning as ChannelSpecExportWarning]
    }
    return []
  })
}
