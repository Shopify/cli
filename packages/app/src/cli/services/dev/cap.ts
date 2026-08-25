import {ClientName, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

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
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
