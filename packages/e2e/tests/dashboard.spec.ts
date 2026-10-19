import {DevDashboardClient} from '../setup/dashboard.js'
import {expect, test, type APIRequestContext, type APIResponse} from '@playwright/test'

const appsUrl = 'https://dev.shopify.com/dashboard/123/apps'
const appUrl = `${appsUrl}/456`
const appName = 'E2E-test-app'
const csrf = '<meta name="csrf-token" content="test&amp;token">'
const appLink = `<a href="${appUrl}"><span>${appName}</span></a>`

test('deletes only the exact E2E app with CSRF protection and confirms its absence', async () => {
  const calls: string[] = []
  const http = {
    async get(url: string) {
      calls.push(url)
      if (url.includes('search_term=')) return response(200, csrf + appLink)
      return calls.length === 2 ? response(200, csrf) : response(404)
    },
    async delete(url: string, options: Parameters<APIRequestContext['delete']>[1]) {
      calls.push(`DELETE ${url}`)
      expect(options?.headers).toEqual({
        'X-CSRF-Token': 'test&token',
        Origin: 'https://dev.shopify.com',
        Referer: `${appUrl}/settings`,
      })
      return response(303, '', {location: '/dashboard/123/apps'})
    },
  }
  await new DevDashboardClient(http, '123').deleteApp({name: appName, url: appUrl})
  expect(calls).toEqual([
    `${appsUrl}?search_term=${appName}`,
    `${appUrl}/settings`,
    `DELETE ${appUrl}`,
    `${appUrl}/settings`,
  ])
})

for (const [name, html, status, message] of [
  ['login redirect', '', 302, 'Check the E2E session'],
  ['server error', '', 503, 'Check the E2E session'],
  ['missing CSRF', appLink, 200, 'no CSRF token'],
  ['unknown page', `${csrf}<p>Loading</p>`, 200, 'Could not verify app search'],
  ['duplicate names', `${csrf + appLink}<a href="${appsUrl}/789">${appName}</a>`, 200, 'Multiple apps'],
  [
    'foreign pagination',
    `${csrf + appLink}<a href="https://example.com/?next_cursor=x">Next</a>`,
    200,
    'outside the E2E organization',
  ],
] as const) {
  test(`rejects ${name} before sending deletion`, async () => {
    let deletionRequested = false
    const http = {
      async get() {
        return response(status, html)
      },
      async delete() {
        deletionRequested = true
        return response(303)
      },
    }
    await expect(new DevDashboardClient(http, '123').deleteApp({name: appName})).rejects.toThrow(message)
    expect(deletionRequested).toBe(false)
  })
}

test('does not delete similarly named apps', async () => {
  const http = {
    async get() {
      return response(200, `${csrf}<a href="${appUrl}">${appName}-other</a>`)
    },
    async delete() {
      throw new Error('Must not delete another app')
    },
  }
  await new DevDashboardClient(http, '123').deleteApp({name: appName})
})

test('requires explicit empty search results and verifies a known app URL', async () => {
  const http = {
    async get(url: string) {
      return url.includes('search_term=') ? response(200, `${csrf}<p>No apps matched your search.</p>`) : response(404)
    },
    async delete() {
      throw new Error('App is already absent')
    },
  }
  await new DevDashboardClient(http, '123').deleteApp({name: appName, url: appUrl})
})

test('rejects unsafe app names and organization URLs before making requests', async () => {
  const http = {
    async get() {
      throw new Error('Must not make a request')
    },
    async delete() {
      throw new Error('Must not make a request')
    },
  }
  const dashboard = new DevDashboardClient(http, '123')
  await expect(dashboard.deleteApp({name: 'production-app'})).rejects.toThrow('non-E2E')
  await expect(
    dashboard.deleteApp({name: appName, url: 'https://dev.shopify.com/dashboard/999/apps/456'}),
  ).rejects.toThrow('configured E2E organization')
})

test('does not treat the remaining-installs redirect as deletion success', async () => {
  const http = {
    async get() {
      return response(200, csrf + appLink)
    },
    async delete() {
      return response(303, '', {location: `${appUrl}/settings`})
    },
  }
  await expect(new DevDashboardClient(http, '123').deleteApp({name: appName})).rejects.toThrow('deletion was rejected')
})

test('follows pagination and rejects repeated cursors', async () => {
  let requests = 0
  const nextLink = `<a href="${appsUrl}?next_cursor=repeat">Next</a>`
  const http = {
    async get() {
      requests++
      return response(200, csrf + appLink + nextLink)
    },
    async delete() {
      throw new Error('Must finish discovery before deletion')
    },
  }
  await expect(new DevDashboardClient(http, '123').deleteApp({name: appName})).rejects.toThrow(
    'pagination did not complete',
  )
  expect(requests).toBe(2)
})

function response(status: number, body = '', headers: Record<string, string> = {}): APIResponse {
  return {
    status: () => status,
    headers: () => ({'content-type': 'text/html', ...headers}),
    text: async () => body,
  } as unknown as APIResponse
}
