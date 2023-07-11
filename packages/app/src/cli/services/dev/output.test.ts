import {outputExtensionsMessages, outputUpdateURLsResult} from './output.js'
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
      expect(outputMock.output()).toMatch(`For your convenience, we've given your app a default URL:`)
      expect(outputMock.output()).toMatch(`${urls.applicationUrl}.`)
      expect(outputMock.output()).toMatch(`You can update your app's URL anytime in the Partners Dashboard [1] But`)
      expect(outputMock.output()).toMatch(`once your app is live, updating its URL will disrupt user access.`)
      expect(outputMock.output()).toMatch(
        `[1] https://partners.shopify.com/${remoteApp.organizationId}/apps/${remoteApp.id}/edit`,
      )
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
      expect(outputMock.output()).toMatch(`To make URL updates manually, you can add the following URLs as redirects`)
      expect(outputMock.output()).toMatch(`in your Partners Dashboard [1]:`)
      expect(outputMock.output()).toMatch(`• ${urls.redirectUrlWhitelist[0]}`)
      expect(outputMock.output()).toMatch(
        `[1] https://partners.shopify.com/${remoteApp.organizationId}/apps/${remoteApp.id}/edit`,
      )
    })

    test('shows how to update app urls with config push when app is not brand new, urls were updated and app uses new config', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp(true)

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(false, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatch(`To update URLs manually, add the following URLs to`)
      expect(outputMock.output()).toMatch(`shopify.app.staging.toml under auth > redirect_urls and run`)
      expect(outputMock.output()).toMatch(`\`npm run shopify app config push -- --config=staging\``)
      expect(outputMock.output()).toMatch(`• ${urls.redirectUrlWhitelist[0]}`)
      expect(outputMock.output()).not.toMatch(`https://partners.shopify.com/`)
    })
  })

  describe('outputExtensionsMessages', () => {
    test('logs the correct output extension message when the given app contains a customer-accounts-ui-extension', async () => {
      const outputMock = mockAndCaptureOutput()
      const appMock = await mockApp()

      outputExtensionsMessages(appMock)

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "theme extension name (Theme)
        Follow the dev doc instructions ( https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes ) by deploying your work as a draft
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

  const configuration = newConfig ? {name: 'lala', client_id: 'abc'} : {scopes: 'my-scope'}
  const configurationPath = joinPath('/', newConfig ? 'shopify.app.staging.toml' : 'shopify.app.toml')

  return testApp({
    name: 'my-super-customer-accounts-app',
    directory: '/',
    configurationPath,
    configuration,
    nodeDependencies,
    allExtensions: [functionExtension, themeExtension, uiExtension],
  })
}
