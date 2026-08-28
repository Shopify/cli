import {ClientName, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export async function devStoreCapReached(
  organizationId: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<boolean> {
  if (developerPlatformClient.clientName !== ClientName.AppManagement || !developerPlatformClient.devStoreCapReached) {
    return false
  }

  try {
    return await developerPlatformClient.devStoreCapReached(organizationId)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
