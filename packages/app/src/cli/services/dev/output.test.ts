import {outputExtensionsMessages, outputDevSuccess} from './output.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {afterEach, describe, expect, it} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('output', () => {
  describe('outputExtensionsMessages', () => {
    it('logs the correct output extension message when the given app contains a customer-accounts-ui-extension', async () => {
      const outputMock = mockAndCaptureOutput()
      const appMock = await mockApp({functions: false})

      outputExtensionsMessages(appMock)

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "theme extension name (Theme app extension)
        Follow the dev doc instructions ( https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes ) by deploying your work as a draft
        "
      `)
    })
  })

  describe('outputPreviewUrl', () => {
    it('renders a banner with instructions on how to preview the app', async () => {
      const outputMock = mockAndCaptureOutput()
      const appMock = await mockApp({functions: false})

      outputDevSuccess(appMock)

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ success ────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Preview ready! Press \`Enter\` to open your browser.                          │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })

    it('renders a banner with instructions on how to preview the app and function related information', async () => {
      const outputMock = mockAndCaptureOutput()
      const appMock = await mockApp({functions: true})

      outputDevSuccess(appMock)

      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ success ────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Preview ready! Press \`Enter\` to open your browser.                          │
        │                                                                              │
        │  Keep in mind that Shopify Functions need to be deployed to be manually      │
        │  tested.                                                                     │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })
  })
})

async function mockApp({functions}: {functions: boolean}): Promise<AppInterface> {
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
      ui: [uiExtension],
      theme: [themeExtension],
      function: functions ? [functionExtension] : [],
    },
  })
}
