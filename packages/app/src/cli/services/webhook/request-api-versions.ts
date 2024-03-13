import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export interface PublicApiVersionsSchema {
  publicApiVersions: string[]
}

export const GetApiVersionsQuery = `
  query getApiVersions {
    publicApiVersions
  }
`

/**
 * Requests available api-versions in order to validate flags or present a list of options
 *
 * @param developerPlatformClient - The client to access the platform API
 * @returns List of public api-versions
 */
export async function requestApiVersions(developerPlatformClient: DeveloperPlatformClient): Promise<string[]> {
  const {publicApiVersions: result}: PublicApiVersionsSchema = await developerPlatformClient.apiVersions()

  const unstableIdx = result.indexOf('unstable')
  if (unstableIdx === -1) {
    result.sort().reverse()
  } else {
    result.splice(unstableIdx, 1)
    result.sort().reverse()
    result.push('unstable')
  }

  return result
}
