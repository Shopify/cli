import {MockI18nProvider} from './MockI18nProvider'
import {MockExtensionServerProvider} from '@shopify/ui-extensions-server-kit/testing'
import {withProviders} from '@shopify/ui-extensions-test-utils'

export const DefaultProviders = withProviders(MockExtensionServerProvider, MockI18nProvider)
