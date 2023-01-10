import {AdminSession} from '../../../session.js'
import {content, token as outputToken} from '../../../output.js'
import {Bug, Abort} from '../../../error.js'
import {graphqlRequest} from '../../../private/common/api/graphql.js'
import {ClientError, gql, RequestDocument, Variables} from 'graphql-request'

export async function adminRequest<T>(
  query: RequestDocument,
  session: AdminSession,
  variables?: Variables,
): Promise<T> {
  const api = 'Admin'
  const version = await fetchApiVersion(session)
  const url = adminUrl(session.storeFqdn, version)
  return graphqlRequest(query, api, url, session.token, variables)
}

async function fetchApiVersion(session: AdminSession): Promise<string> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  try {
    const data: ApiVersionResponse = await graphqlRequest(query, 'Admin', url, session.token, {}, false)

    return data.publicApiVersions
      .filter((item) => item.supported)
      .map((item) => item.handle)
      .sort()
      .reverse()[0]!
  } catch (error) {
    if (error instanceof ClientError && error.response.status === 403) {
      const storeName = session.storeFqdn.replace('.myshopify.com', '')
      throw new Abort(
        content`Looks like you don't have access this dev store: (${outputToken.link(
          storeName,
          `https://${session.storeFqdn}`,
        )})`,
        content`If you're not the owner, create a dev store staff account for yourself`,
      )
    }
    throw new Bug(`Unknown error connecting to your store`)
  }
}

function adminUrl(store: string, version: string | undefined): string {
  const realVersion = version || 'unstable'
  return `https://${store}/admin/api/${realVersion}/graphql.json`
}

interface ApiVersionResponse {
  publicApiVersions: {handle: string; supported: boolean}[]
}

function apiVersionQuery(): string {
  return gql`
    query {
      publicApiVersions {
        handle
        supported
      }
    }
  `
}
