import {MockExtensionServerProvider} from '@shopify/ui-extensions-server-kit/testing';
import {withProviders} from '@shopify/shopify-cli-extensions-test-utils';

import {MockAppProvider} from './MockAppProvider';
import {MockI18nProvider} from './MockI18nProvider';

export const DefaultProviders = withProviders(
  MockExtensionServerProvider,
  MockI18nProvider,
  MockAppProvider,
);
