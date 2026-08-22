import {ClientName, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

/**
 * A cap check is advisory. Older Business Platform deployments may not expose the field yet,
 * so request and schema errors must not block store creation.
 */
export async function devStoreCapReached(
  organizationId: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<boolean> {
  const capChecker = developerPlatformClient.devStoreCapReached
  if (developerPlatformClient.clientName !== ClientName.AppManagement || !capChecker) {
    return false
  }

  try {
    return await capChecker(organizationId)
  } catch {
    return false
  }
}
