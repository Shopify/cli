import {outputExtensionsMessages} from './output.js'
import {testApp, testUIExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {describe, expect, it} from 'vitest'
import {outputMocker, path} from '@shopify/cli-kit'

describe('output', () => {
  it('logs the correct output extension message when the given app contains a customer-accounts-ui-extension', async () => {
    const outputMock = outputMocker.mockAndCaptureOutput()
    const appMock = await mockApp()

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
})

async function mockApp(currentVersion = '2.2.2'): Promise<AppInterface> {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion

  const extension = await testUIExtension({
    configuration: {
      type: 'customer_accounts_ui_extension',
      name: 'customer-accounts-ui-extension',
      metafields: [{key: '', namespace: ''}],
      categories: ['returns'],
    },
    devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
  })

  return testApp({
    name: 'my-super-customer-accounts-app',
    directory: '/',
    configurationPath: path.join('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
    },
    nodeDependencies,
    extensions: {
      ui: [extension],
      theme: [],
      function: [],
    },
  })
}
