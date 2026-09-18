import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {numericIdFromGid} from '@shopify/cli-kit/common/gid'
import {appManagementHeaders} from '@shopify/cli-kit/node/api/app-management'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
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
  // App Management returns app ids as GIDs (gid://shopify/App/<id>); the REST path needs the numeric id.
  const appId = numericIdFromGid(remoteApp.id) ?? remoteApp.id
  const url = `https://${fqdn}/app_management/unstable/organizations/${encodeURIComponent(
    remoteApp.organizationId,
  )}/apps/${encodeURIComponent(appId)}/channel_spec_export.json`
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

  let decoded: unknown
  try {
    decoded = await response.json()
  } catch {
    throw new AbortError(`Failed to fetch the channel spec export: unexpected response (status ${response.status}).`)
  }

  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
    throw new AbortError(`Failed to fetch the channel spec export: unexpected response (status ${response.status}).`)
  }
  const payload = decoded as {[key: string]: unknown}

  // Only 422 carries a well-formed export failure ({error, reason}); any other non-ok status is a
  // transport/auth/server problem and should not be presented as "this app can't be exported".
  if (response.status === 422) {
    const reason = typeof payload.reason === 'string' ? payload.reason : `http_${response.status}`
    return {success: false, reason}
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AbortError(
        `Failed to fetch the channel spec export: authentication failed (status ${response.status}).`,
        'Log out with `shopify auth logout` and re-run the command to refresh your session.',
      )
    }
    throw new AbortError(
      `Failed to fetch the channel spec export: the server responded with status ${response.status}.`,
      'This is likely temporary. Wait a moment and try again.',
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
