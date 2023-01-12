import {api} from '@shopify/cli-kit'

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
 */
export async function requestApiVersions(token: string) {
  const {publicApiVersions: result}: PublicApiVersionsSchema = await api.partners.request(getApiVersionsQuery, token)

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
