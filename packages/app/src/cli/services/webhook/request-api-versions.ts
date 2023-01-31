import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export interface PublicApiVersionsSchema {
  publicApiVersions: string[]
}

const getApiVersionsQuery = `
  query getApiVersions {
    publicApiVersions
  }
`

/**
 * Requests available api-versions in order to validate flags or present a list of options
 *
 * @param token - Partners session token
 * @returns List of public api-versions
 */
export async function requestApiVersions(token: string): Promise<string[]> {
  const {publicApiVersions: result}: PublicApiVersionsSchema = await partnersRequest(getApiVersionsQuery, token)

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
