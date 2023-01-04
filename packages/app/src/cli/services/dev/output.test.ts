/* eslint-disable no-irregular-whitespace */
import {outputExtensionsMessages} from './output.js'
import {testApp, testThemeExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {UIExtension} from '../../models/app/extensions.js'
import {beforeEach, describe, expect, it} from 'vitest'
import {outputMocker, path} from '@shopify/cli-kit'

const outputMock = outputMocker.mockAndCaptureOutput()
beforeEach(() => {
  outputMock.clear()
})

describe('output', () => {
  it('logs the correct output extension message when the given app contains a customer-accounts-ui-extension', async () => {
    const appMock = await mockApp()
    appMock.extensions.ui.push(await mockCheckOutUIExtension())

    outputExtensionsMessages(appMock, 'shop1010', 'https://f97b-95-91-224-153.eu.ngrok.io')

    expect(outputMock.output()).toMatchInlineSnapshot(`
      "Shopify extension dev console URL

        https://f97b-95-91-224-153.eu.ngrok.io/extensions/dev-console

      customer-accounts-ui-extension (Customer accounts UI)
      Please open https://f97b-95-91-224-153.eu.ngrok.io and click on 'Visit Site' and then close the tab to allow connections.
      Preview link: https://shop1010.account./extensions-development?origin=https%3A%2F%2Ff97b-95-91-224-153.eu.ngrok.io%2Fextensions&extensionId=dev-94b5f0a6-1264-461d-8f78-08db4565b044
      "
    `)
  })

  it('logs the correct output extension message when the given app contains a customer-accounts-ui-extension and category is skipped', async () => {
    const appMock = await mockApp()
    appMock.extensions.ui.push(await mockCheckOutUIExtension())

    outputExtensionsMessages(appMock, 'shop1010', 'https://f97b-95-91-224-153.eu.ngrok.io', ['ui'])

    expect(outputMock.output()).toMatchInlineSnapshot(`
      "ui Extensions
        Skipped in this run
      "
    `)
  })

  it('logs the correct output extension message when the given app contains a theme-app-extension', async () => {
    const appMock = await mockApp()
    appMock.extensions.theme.push(await testThemeExtensions())

    outputExtensionsMessages(appMock, 'shop1010', 'https://f97b-95-91-224-153.eu.ngrok.io')

    expect(outputMock.output()).toMatchInlineSnapshot(`
      "theme extension name (Theme app extension)
      Follow the dev doc instructions (​https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes​) by deploying your work as a draft
      "
    `)
  })

  it('logs the correct output extension message when the given app contains a theme-app-extension and category is skipped', async () => {
    const appMock = await mockApp()
    appMock.extensions.theme.push(await testThemeExtensions())

    outputExtensionsMessages(appMock, 'shop1010', 'https://f97b-95-91-224-153.eu.ngrok.io', ['theme'])

    expect(outputMock.output()).toMatchInlineSnapshot(`
      "theme Extensions
        Skipped in this run
      "
    `)
  })
})

async function mockApp(currentVersion = '2.2.2'): Promise<AppInterface> {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion

  return testApp({
    name: 'my-super-customer-accounts-app',
    directory: '/',
    configurationPath: path.join('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
    },
    nodeDependencies,
    extensions: {
      ui: [],
      theme: [],
      function: [],
    },
  })
}

async function mockCheckOutUIExtension(): Promise<UIExtension> {
  return testUIExtension({
    configuration: {
      type: 'customer_accounts_ui_extension',
      name: 'customer-accounts-ui-extension',
      metafields: [{key: '', namespace: ''}],
      categories: ['returns'],
    },
    devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
  })
}
