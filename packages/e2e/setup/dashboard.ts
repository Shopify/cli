/* eslint-disable no-await-in-loop */
import {authFixture} from './auth.js'
import {authStatePaths} from './auth-state.js'
import {requireEnv} from './env.js'
import {loadtestHeaderRecord} from '../helpers/loadtest-header.js'
import {request, type APIRequestContext, type APIResponse} from '@playwright/test'
import {parse, type DefaultTreeAdapterTypes} from 'parse5'
import {setTimeout as delay} from 'node:timers/promises'

const DASHBOARD_ORIGIN = 'https://dev.shopify.com'
const APP_DELETION_TIMEOUT_MS = 15_000
type HtmlNode = DefaultTreeAdapterTypes.Node
type HtmlElement = DefaultTreeAdapterTypes.Element

/** Uses the dashboard's authenticated HTTP routes without launching a browser. */
export class DevDashboardClient {
  private readonly appsUrl: string

  constructor(
    private readonly http: Pick<APIRequestContext, 'get' | 'delete'>,
    orgId: string,
  ) {
    if (!/^\d+$/.test(orgId)) throw new Error('A numeric E2E organization ID is required.')
    this.appsUrl = `${DASHBOARD_ORIGIN}/dashboard/${orgId}/apps`
  }

  async deleteApp({
    name,
    url,
    uninstallConfirmed = false,
  }: {
    name: string
    url?: string
    /** Allow the dashboard installation count to settle after a successful uninstall. */
    uninstallConfirmed?: boolean
  }): Promise<void> {
    if (!name.startsWith('E2E-')) throw new Error(`Refusing to delete non-E2E app ${name}.`)
    if (url) this.requireAppUrl(url)

    const appUrl = await this.findApp(name)
    if (!appUrl) {
      if (url && (await this.http.get(`${url}/settings`)).status() !== 404) {
        throw new Error(`App ${name} was absent from search but its deletion could not be verified.`)
      }
      return
    }
    if (url && url !== appUrl) throw new Error(`App ${name} has an unexpected dashboard ID.`)

    const deadline = Date.now() + APP_DELETION_TIMEOUT_MS
    let deletionAccepted = false
    do {
      const settings = await this.http.get(`${appUrl}/settings`, {timeout: Math.max(1, deadline - Date.now())})
      const document = await readDashboardPage(settings)
      const csrfToken = readCsrfToken(document)
      const deleted = await this.http.delete(appUrl, {
        timeout: Math.max(1, deadline - Date.now()),
        headers: {'X-CSRF-Token': csrfToken, Origin: DASHBOARD_ORIGIN, Referer: `${appUrl}/settings`},
      })
      const location = deleted.headers().location
      const redirect =
        location && URL.canParse(location, DASHBOARD_ORIGIN) ? new URL(location, DASHBOARD_ORIGIN) : undefined
      if (deleted.status() === 303 && redirect?.href === this.appsUrl) {
        deletionAccepted = true
        break
      }
      if (!uninstallConfirmed || deleted.status() !== 303 || redirect?.href !== `${appUrl}/settings`) {
        const target = redirect ? `${redirect.origin}${redirect.pathname}` : 'missing or invalid'
        throw new Error(`App ${name} deletion was rejected (HTTP ${deleted.status()}, redirect: ${target}).`)
      }
      // The dashboard guards deletion with a search index that can lag behind a successful uninstall.
      await delay(Math.min(1000, Math.max(0, deadline - Date.now())))
    } while (Date.now() < deadline)
    if (!deletionAccepted) {
      throw new Error(`App ${name} deletion timed out waiting for the dashboard installation count to reach zero.`)
    }

    do {
      const response = await this.http.get(`${appUrl}/settings`, {timeout: Math.max(1, deadline - Date.now())})
      if (response.status() === 404) return
      await readDashboardPage(response)
      await delay(Math.min(1000, Math.max(0, deadline - Date.now())))
    } while (Date.now() < deadline)
    throw new Error(`Deletion of app ${name} was not confirmed.`)
  }

  private async findApp(name: string): Promise<string | undefined> {
    let nextUrl: string | undefined = `${this.appsUrl}?search_term=${encodeURIComponent(name)}`
    const visited = new Set<string>()
    const matches = new Set<string>()

    while (nextUrl) {
      if (visited.has(nextUrl) || visited.size >= 50) throw new Error('App search pagination did not complete.')
      visited.add(nextUrl)
      const document = await readDashboardPage(await this.http.get(nextUrl))
      const links = elements(document).filter((element) => element.tagName === 'a')
      const appLinks = links.filter((link) => {
        const href = attribute(link, 'href')
        return href && new URL(href, DASHBOARD_ORIGIN).href.startsWith(`${this.appsUrl}/`)
      })
      if (!appLinks.length && !textContent(document).includes('No apps matched your search.')) {
        throw new Error(`Could not verify app search results for ${name}.`)
      }
      for (const link of appLinks) {
        if (textContent(link).trim() !== name) continue
        const appUrl = new URL(attribute(link, 'href')!, DASHBOARD_ORIGIN).href
        this.requireAppUrl(appUrl)
        matches.add(appUrl)
      }
      const nextLinks = links.filter((link) => attribute(link, 'href')?.includes('next_cursor='))
      if (nextLinks.length > 1) throw new Error('App search returned ambiguous pagination.')
      const nextHref = nextLinks[0] && attribute(nextLinks[0], 'href')
      nextUrl = nextHref ? new URL(nextHref, DASHBOARD_ORIGIN).href : undefined
      if (nextUrl && new URL(nextUrl).origin + new URL(nextUrl).pathname !== this.appsUrl) {
        throw new Error('App search returned a URL outside the E2E organization.')
      }
    }
    if (matches.size > 1) throw new Error(`Multiple apps have the E2E name ${name}.`)
    return [...matches][0]
  }

  private requireAppUrl(url: string): void {
    if (!url.startsWith(`${this.appsUrl}/`) || !/^\d+$/.test(url.slice(this.appsUrl.length + 1))) {
      throw new Error('App URL must belong to the configured E2E organization.')
    }
  }
}

async function readDashboardPage(response: APIResponse): Promise<DefaultTreeAdapterTypes.Document> {
  if (response.status() !== 200 || !response.headers()['content-type']?.includes('text/html')) {
    throw new Error(`Dashboard request failed (HTTP ${response.status()}). Check the E2E session.`)
  }
  const document = parse(await response.text())
  readCsrfToken(document)
  return document
}

function readCsrfToken(document: HtmlNode): string {
  const meta = elements(document).find(
    (element) => element.tagName === 'meta' && attribute(element, 'name') === 'csrf-token',
  )
  const token = meta && attribute(meta, 'content')
  if (!token) throw new Error('Dashboard response has no CSRF token. Check the E2E session.')
  return token
}

function attribute(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value
}

function elements(node: HtmlNode): HtmlElement[] {
  const children = 'childNodes' in node ? node.childNodes.flatMap(elements) : []
  return 'tagName' in node ? [node, ...children] : children
}

function textContent(node: HtmlNode): string {
  if ('value' in node) return node.value
  return 'childNodes' in node ? node.childNodes.map(textContent).join('') : ''
}

export const dashboardFixture = authFixture.extend<{}, {dashboard: DevDashboardClient}>({
  dashboard: [
    async ({env, authLogin: _authLogin}, use) => {
      requireEnv(env, 'orgId')
      const http = await createDashboardRequest(authStatePaths().storageStatePath)
      try {
        await use(new DevDashboardClient(http, env.orgId))
      } finally {
        await http.dispose()
      }
    },
    {scope: 'worker'},
  ],
})

export function createDashboardRequest(
  storageState: NonNullable<Parameters<typeof request.newContext>[0]>['storageState'],
) {
  return request.newContext({
    storageState,
    extraHTTPHeaders: {Accept: 'text/html', ...loadtestHeaderRecord()},
    maxRedirects: 0,
    timeout: 20_000,
  })
}
