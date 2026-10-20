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
  let deletionRequests = 0
  const http = {
    async get() {
      return response(200, csrf + appLink)
    },
    async delete() {
      deletionRequests++
      return response(303, '', {location: `${appUrl}/settings`})
    },
  }
  await expect(new DevDashboardClient(http, '123').deleteApp({name: appName})).rejects.toThrow('deletion was rejected')
  expect(deletionRequests).toBe(1)
})

test('retries a stale installation count after confirmed uninstall and refreshes CSRF', async () => {
  let deletionRequests = 0
  const http = {
    async get(url: string) {
      if (url.includes('search_term=')) return response(200, csrf + appLink)
      if (deletionRequests === 2) return response(404)
      return response(200, `<meta name="csrf-token" content="token-${deletionRequests}">`)
    },
    async delete(url: string, options: Parameters<APIRequestContext['delete']>[1]) {
      expect(url).toBe(appUrl)
      expect(options?.headers?.['X-CSRF-Token']).toBe(`token-${deletionRequests}`)
      deletionRequests++
      return response(303, '', {location: deletionRequests === 1 ? `${appUrl}/settings` : appsUrl})
    },
  }
  await new DevDashboardClient(http, '123').deleteApp({name: appName, url: appUrl, uninstallConfirmed: true})
  expect(deletionRequests).toBe(2)
})

for (const [status, location] of [
  [302, `${appUrl}/settings`],
  [503, `${appUrl}/settings`],
  [303, `${appsUrl}/789/settings`],
  [303, 'https://example.com/dashboard/123/apps/456/settings'],
  [303, 'https://accounts.shopify.com/lookup?token=secret-query#secret-fragment'],
  [303, ''],
  [303, 'http://[invalid'],
] as const) {
  test(`does not retry an unexpected deletion response after uninstall (${status}, ${location})`, async () => {
    let deletionRequests = 0
    const http = {
      async get() {
        return response(200, csrf + appLink)
      },
      async delete() {
        deletionRequests++
        return response(status, '', {location})
      },
    }
    const deletion = new DevDashboardClient(http, '123').deleteApp({name: appName, uninstallConfirmed: true})
    await expect(deletion).rejects.toThrow('deletion was rejected')
    await expect(deletion).rejects.not.toThrow('secret-query')
    await expect(deletion).rejects.not.toThrow('secret-fragment')
    expect(deletionRequests).toBe(1)
  })
}

test('stops retrying when the installation count has not settled after 15 seconds', async () => {
  const originalNow = Date.now
  let now = originalNow()
  let deletionRequests = 0
  try {
    Date.now = () => now
    const http = {
      async get() {
        return response(200, csrf + appLink)
      },
      async delete() {
        deletionRequests++
        now += 15_000
        return response(303, '', {location: `${appUrl}/settings`})
      },
    }
    await expect(
      new DevDashboardClient(http, '123').deleteApp({name: appName, uninstallConfirmed: true}),
    ).rejects.toThrow('timed out waiting for the dashboard installation count to reach zero')
    expect(deletionRequests).toBe(1)
  } finally {
    Object.defineProperty(Date, 'now', {value: originalNow})
  }
})

test('stops retrying if the dashboard session is lost after an installation-count redirect', async () => {
  let deletionRequests = 0
  const http = {
    async get() {
      return deletionRequests === 0 ? response(200, csrf + appLink) : response(302)
    },
    async delete() {
      deletionRequests++
      return response(303, '', {location: `${appUrl}/settings`})
    },
  }
  await expect(
    new DevDashboardClient(http, '123').deleteApp({name: appName, uninstallConfirmed: true}),
  ).rejects.toThrow('Check the E2E session')
  expect(deletionRequests).toBe(1)
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
