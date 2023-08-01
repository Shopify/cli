import {outputUpdateURLsResult} from './output.js'
import {
  testApp,
  testFunctionExtension,
  testOrganizationApp,
  testThemeExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {afterEach, describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('output', () => {
  describe('outputUpdateURLsResult', () => {
    const urls = {
      applicationUrl: 'https://lala.cloudflare.io/',
      redirectUrlWhitelist: ['https://lala.cloudflare.io/auth/callback'],
    }

    test('shows info about tunnel URL and links to Partners Dashboard when app is brand new', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp()

      const remoteApp = testOrganizationApp({newApp: true})

      // When
      await outputUpdateURLsResult(true, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  For your convenience, we've given your app a default URL:                   │
        │  https://lala.cloudflare.io/.                                                │
        │                                                                              │
        │  You can update your app's URL anytime in the Partners Dashboard [1] But     │
        │  once your app is live, updating its URL will disrupt user access.           │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://partners.shopify.com/1/apps/1/edit
        "
      `)
    })

    test('shows nothing when urls were updated', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp()

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(true, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toEqual('')
    })

    test('shows how to update app urls on partners when app is not brand new, urls were not updated and app uses legacy config', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp()

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(false, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  To make URL updates manually, you can add the following URLs as redirects   │
        │  in your Partners Dashboard [1]:                                             │
        │                                                                              │
        │                                                                              │
        │    • https://lala.cloudflare.io/auth/callback                                │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://partners.shopify.com/1/apps/1/edit
        "
      `)
    })

    test('shows how to update app urls with config push when app is not brand new, urls were updated and app uses new config', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp(true)

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(false, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  To update URLs manually, add the following URLs to                          │
        │  shopify.app.staging.toml under auth > redirect_urls and run                 │
        │   \`yarn shopify app config push --config=staging\`                            │
        │                                                                              │
        │                                                                              │
        │    • https://lala.cloudflare.io/auth/callback                                │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })
  })
})

async function mockApp(newConfig = false): Promise<AppInterface> {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = '2.2.2'

  const functionExtension = await testFunctionExtension()
  const themeExtension = await testThemeExtensions()
  const uiExtension = await testUIExtension()

  const configurationPath = joinPath('/', newConfig ? 'shopify.app.staging.toml' : 'shopify.app.toml')

  return testApp(
    {
      name: 'my-super-customer-accounts-app',
      directory: '/',
      configurationPath,
      nodeDependencies,
      allExtensions: [functionExtension, themeExtension, uiExtension],
    },
    newConfig ? 'current' : 'legacy',
  )
}
