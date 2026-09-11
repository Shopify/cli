import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {appManagementHeaders} from '@shopify/cli-kit/node/api/app-management'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface ChannelSpecExportWarning {
  code: string
  message: string
}

export type ChannelSpecExportResult =
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
 * Fetches the partner-safe channel spec export for an app.
 *
 * The export itself is produced server-side by the Channels-owned exporter, which projects the
 * Shopify-authored default channel specification into the public channel_config schema and
 * validates it before returning it. The CLI intentionally does not transform or validate the
 * TOML locally: the backend response is the deployable artifact.
 */
export async function fetchChannelSpecExport({
  remoteApp,
  developerPlatformClient,
}: FetchChannelSpecExportOptions): Promise<ChannelSpecExportResult> {
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/app_management/unstable/organizations/${remoteApp.organizationId}/apps/${remoteApp.id}/channel_spec_export.json`
  const token = (await developerPlatformClient.session()).token

  const response = await shopifyFetch(url, {
    method: 'GET',
    headers: appManagementHeaders(token),
  })

  if (response.status === 404) {
    // A 404 is not part of the export contract (failures are 422 with a reason code). It means the
    // export endpoint isn't available (not deployed yet), or the app/organization couldn't be found.
    throw new AbortError(
      'The channel spec export endpoint is not available for this app.',
      'Confirm the app and organization are correct, and that the channel spec export backend is available.',
    )
  }

  let payload: {[key: string]: unknown}
  try {
    payload = (await response.json()) as {[key: string]: unknown}
  } catch {
    throw new AbortError(`Failed to fetch the channel spec export: unexpected response (status ${response.status}).`)
  }

  if (!response.ok) {
    const reason = typeof payload.reason === 'string' ? payload.reason : `http_${response.status}`
    return {success: false, reason}
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
