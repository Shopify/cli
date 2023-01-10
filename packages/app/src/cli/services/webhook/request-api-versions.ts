import {api, session} from '@shopify/cli-kit'

export interface PublicApiVersionsSchema {
  publicApiVersions: string[]
}

const getApiVersionsQuery = `
  query getApiVersions {
    publicApiVersions
  }
`

export async function requestApiVersions() {
  const token = await session.ensureAuthenticatedPartners()

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
