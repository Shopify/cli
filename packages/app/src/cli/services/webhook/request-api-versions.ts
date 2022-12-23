import {api, session} from '@shopify/cli-kit'

export interface ApiVersionsSchema {
  apiVersions: string[]
}

const getApiVersionsQuery = `
  query getApiVersions {
    apiVersions
  }
`

export async function requestApiVersions() {
  const token = await session.ensureAuthenticatedPartners()

  const {apiVersions: result}: ApiVersionsSchema = await api.partners.request(getApiVersionsQuery, token)

  return result
}
