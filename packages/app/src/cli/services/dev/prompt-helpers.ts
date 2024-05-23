import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export function searchForAppsByNameFactory(developerPlatformClient: DeveloperPlatformClient, orgId: string) {
  return async (term: string) => {
    const result = await developerPlatformClient.appsForOrg(orgId, term)
    return {apps: result.apps, hasMorePages: result.hasMorePages}
  }
}
