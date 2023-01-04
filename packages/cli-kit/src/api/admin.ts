import {buildHeaders, debugLogRequest, handlingErrors} from './common.js'
import fetch from '../http/fetch.js'
import {AdminSession} from '../session.js'
import {debug, content, token as outputToken} from '../output.js'
import {Bug, Abort} from '../error.js'
import {graphqlClient} from '../http/graphql.js'
import {AnyJson} from '../json.js'
import {gql, RequestDocument, Variables} from 'graphql-request'

export async function request<T>(query: RequestDocument, session: AdminSession, variables?: Variables): Promise<T> {
  const api = 'Admin'
  return handlingErrors(api, async () => {
    const version = await fetchApiVersion(session)
    const url = adminUrl(session.storeFqdn, version)
    const headers = await buildHeaders(session.token)
    const client = await graphqlClient({headers, url})
    debugLogRequest(api, query, variables, headers)
    const response = await client.request<T>(query, variables)
    return response
  })
}

export interface RestResponse {
  // Using `any` to avoid introducing extra DTO layers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any
  status: number
  headers: {[key: string]: string[]}
}

export async function restRequest(
  method: string,
  path: string,
  session: AdminSession,
  requestBody?: AnyJson,
  apiVersion = 'unstable',
): Promise<RestResponse> {
  const url = restRequestUrl(session, apiVersion, path)
  const body = restRequestBody(requestBody)

  const headers = await restRequestHeaders(session)
  const response = await fetch(url, {
    headers,
    method,
    body,
  })

  const json = await response.json()

  return {
    json,
    status: response.status,
    headers: response.headers.raw(),
  }
}

function restRequestBody(requestBody?: AnyJson) {
  if (!requestBody) {
    return
  }
  return JSON.stringify(requestBody)
}

function restRequestUrl(session: AdminSession, apiVersion: string, path: string) {
  if (isThemeAccessSession(session)) {
    return `https://theme-kit-access.shopifyapps.com/cli/admin/api/${apiVersion}${path}.json`
  }

  return `https://${session.storeFqdn}/admin/api/${apiVersion}${path}.json`
}

async function restRequestHeaders(session: AdminSession) {
  const store = session.storeFqdn
  const token = session.token
  const headers = await buildHeaders(session.token)

  if (isThemeAccessSession(session)) {
    headers['X-Shopify-Shop'] = store
    headers['X-Shopify-Access-Token'] = token
  }

  return headers
}

function isThemeAccessSession(session: AdminSession) {
  return session.token.startsWith('shptka_')
}

async function fetchApiVersion(session: AdminSession): Promise<string> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  const headers = await buildHeaders(session.token)
  const client = await graphqlClient({url, headers})
  debug(`
Sending Admin GraphQL request to URL ${url} with query:
${query}
  `)
  const data = await client
    .request<{
      publicApiVersions: {handle: string; supported: boolean}[]
    }>(query, {})
    .catch((err) => {
      if (err.response.status === 403) {
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
    })

  return data.publicApiVersions
    .filter((item) => item.supported)
    .map((item) => item.handle)
    .sort()
    .reverse()[0]!
}

function adminUrl(store: string, version: string | undefined): string {
  const realVersion = version || 'unstable'
  return `https://${store}/admin/api/${realVersion}/graphql.json`
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
