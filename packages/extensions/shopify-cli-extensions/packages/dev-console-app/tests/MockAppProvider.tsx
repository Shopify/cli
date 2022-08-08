import React from 'react';
import {AppProvider} from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';

export function MockAppProvider({children}: React.PropsWithChildren<{}>) {
  return <AppProvider i18n={enTranslations}>{children}</AppProvider>;
}
