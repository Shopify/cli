import React from 'react';
import '@shopify/polaris/dist/styles.css';

import enTranslations from '@shopify/polaris/locales/en.json';
import {AppProvider} from '@shopify/polaris';
import * as styles from './theme.css'
import {UIExtensionsDevTool} from './UIExtensionsDevTool';

import {I18nContext, I18nManager} from '@shopify/react-i18n';

function App() {
  const locale = 'en';
  const i18nManager = new I18nManager({
    locale,
    onError(error) {
      console.log(error);
    },
  });

  return (
    <div className={styles.Theme}>
      <I18nContext.Provider value={i18nManager}>
        <AppProvider i18n={enTranslations}>
          <UIExtensionsDevTool />
        </AppProvider>
      </I18nContext.Provider>
    </div>
  );
}

export default App;
