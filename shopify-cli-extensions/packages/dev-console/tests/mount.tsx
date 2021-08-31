import React from 'react';
import {createMount} from '@shopify/react-testing';

import enTranslations from '@shopify/polaris/locales/en.json';
import {AppProvider} from '@shopify/polaris';
import {I18nContext, I18nManager} from '@shopify/react-i18n';

export const mount = createMount({
  render(element) {
    const locale = 'en';
    const i18nManager = new I18nManager({
      locale,
      onError(error) {
        console.log(error);
      },
    });

    return (
      <I18nContext.Provider value={i18nManager}>
        <AppProvider i18n={enTranslations}>
          {element}
        </AppProvider>
      </I18nContext.Provider>
    );
  }
});
