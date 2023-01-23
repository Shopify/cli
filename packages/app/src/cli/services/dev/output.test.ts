import {outputExtensionsMessages, outputPreviewUrl} from './output.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {afterEach, describe, expect, it} from 'vitest'
import {outputMocker} from '@shopify/cli-kit'
import {joinPath} from '@shopify/cli-kit/node/path'

afterEach(() => {
  outputMocker.mockAndCaptureOutput().clear()
})

describe('output', () => {
  describe('outputExtensionsMessages', () => {
    it('logs the correct output extension message when the given app contains a customer-accounts-ui-extension', async () => {
      const outputMock = outputMocker.mockAndCaptureOutput()
      const appMock = await mockApp({uiExtensions: false})

      outputExtensionsMessages(appMock)

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "test function extension
        These extensions need to be deployed to be manually tested.
        One testing option is to use a separate app dedicated to staging.

        theme extension name (Theme app extension)
        Follow the dev doc instructions ( https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes ) by deploying your work as a draft
        "
      `)
    })
  })

  describe('outputPreviewUrl', () => {
    it('renders a banner with a link to the dev console if there are ui extensions', async () => {
      const outputMock = outputMocker.mockAndCaptureOutput()
      const appMock = await mockApp({uiExtensions: true})

      outputPreviewUrl({
        app: appMock,
        storeFqdn: 'my-store.myshopify.com',
        exposedUrl: 'https://my-store.myshopify.com',
        proxyUrl: 'https://my-store.myshopify.com',
        appPreviewAvailable: true,
      })

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ success ────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Preview ready! Press any key to open your browser                           │
        │                                                                              │
        │  https://my-store.myshopify.com/extensions/dev-console                       │
        │                                                                              │
        │  Keep in mind that some Shopify extensions - like Functions and web pixel -  │
        │   aren't yet available for dev previews.                                     │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })

    it('renders a banner with a link to the app if there are no ui extensions', async () => {
      const outputMock = outputMocker.mockAndCaptureOutput()
      const appMock = await mockApp({uiExtensions: false})

      outputPreviewUrl({
        app: appMock,
        storeFqdn: 'my-store.myshopify.com',
        exposedUrl: 'https://my-store.myshopify.com',
        proxyUrl: 'https://my-store.myshopify.com',
        appPreviewAvailable: true,
      })

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ success ────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Preview ready! Press any key to open your browser                           │
        │                                                                              │
        │  https://my-store.myshopify.com?shop=my-store.myshopify.com&host=bXktc3Rvcm  │
        │  UubXlzaG9waWZ5LmNvbS9hZG1pbg                                                │
        │                                                                              │
        │  Keep in mind that some Shopify extensions - like Functions and web pixel -  │
        │   aren't yet available for dev previews.                                     │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })
  })
})

async function mockApp({uiExtensions}: {uiExtensions: boolean}): Promise<AppInterface> {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = '2.2.2'

  const functionExtension = await testFunctionExtension()
  const themeExtension = await testThemeExtensions()
  const uiExtension = await testUIExtension()

  return testApp({
    name: 'my-super-customer-accounts-app',
    directory: '/',
    configurationPath: joinPath('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
    },
    nodeDependencies,
    extensions: {
      ui: uiExtensions ? [uiExtension] : [],
      theme: [themeExtension],
      function: [functionExtension],
    },
  })
}
