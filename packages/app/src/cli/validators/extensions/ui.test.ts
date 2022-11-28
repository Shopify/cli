import {validateUIExtensions} from './ui.js'
import {testUIExtension} from '../../models/app/app.test-data.js'
import {describe, expect, it} from 'vitest'
import {error} from '@shopify/cli-kit'

describe('ui', () => {
  describe('customer_accounts_ui_extension', () => {
    it('should not throw when "authenticatedRedirectStartUrl" and "authenticatedRedirectRedirectUrls" are unset', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      expect(() => validateUIExtensions([extension])).not.toThrow()
    })

    it('should not throw when "authenticatedRedirectStartUrl" and "authenticatedRedirectRedirectUrls" are set and valid', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
          authenticatedRedirectStartUrl: 'https://www.shopify.com/start',
          authenticatedRedirectRedirectUrls: ['https://www.shopify.com/finalize', 'https://www.loop.com/finalize'],
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      expect(() => validateUIExtensions([extension])).not.toThrow()
    })

    it('should throw when "authenticatedRedirectStartUrl" is not a valid URL', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
          authenticatedRedirectStartUrl: '/start-url',
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      await expect(validateUIExtensions([extension])).rejects.toThrow(
        new error.Abort(
          `The property "authenticated_redirect_start_url" does not contain a valid URL.`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_start_url"`,
        ),
      )
    })

    it('should throw when "authenticatedRedirectStartUrl" is an empty string', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
          authenticatedRedirectStartUrl: '',
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      await expect(validateUIExtensions([extension])).rejects.toThrow(
        new error.Abort(
          `The property "authenticated_redirect_start_url" does not contain a valid URL.`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_start_url"`,
        ),
      )
    })

    it('should throw when "authenticatedRedirectRedirectUrls" contains an invalid URL', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
          authenticatedRedirectRedirectUrls: ['/start-url'],
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      await expect(validateUIExtensions([extension])).rejects.toThrow(
        new error.Abort(
          `The property "authenticated_redirect_redirect_urls" does contain invalid URLs. More specifically, the following values are invalid: "/start-url".`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_redirect_urls"`,
        ),
      )
    })

    it('should throw when one of the "authenticatedRedirectRedirectUrls" is an invalid URL', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
          authenticatedRedirectRedirectUrls: ['/start-url', 'https://www.shopify.com/', '/end-url'],
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      await expect(validateUIExtensions([extension])).rejects.toThrow(
        new error.Abort(
          `The property "authenticated_redirect_redirect_urls" does contain invalid URLs. More specifically, the following values are invalid: "/start-url, /end-url".`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_redirect_urls"`,
        ),
      )
    })

    it('should throw when "authenticatedRedirectRedirectUrls" is an empty array', async () => {
      const extension = await testUIExtension({
        configuration: {
          type: 'customer_accounts_ui_extension',
          name: 'customer-accounts-ui-extension',
          metafields: [],
          authenticatedRedirectRedirectUrls: [],
        },
        devUUID: 'dev-94b5f0a6-1264-461d-8f78-08db4565b044',
      })

      await expect(validateUIExtensions([extension])).rejects.toThrow(
        new error.Abort(
          `The property "authenticated_redirect_redirect_urls" can not be an empty array! It may only contain one or multiple valid URLs`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_redirect_urls"`,
        ),
      )
    })
  })
})
