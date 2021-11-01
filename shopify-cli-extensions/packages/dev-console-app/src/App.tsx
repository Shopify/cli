import React, {useMemo} from 'react';
import '@shopify/polaris/dist/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';
import {AppProvider} from '@shopify/polaris';
import {I18nContext, I18nManager} from '@shopify/react-i18n';
import {DevConsoleProvider} from '@shopify/ui-extensions-server-kit';

import * as styles from './theme.module.css';
import {DevConsole} from './DevConsole';

function App() {
  const locale = 'en';
  const i18nManager = useMemo(
    () =>
      new I18nManager({
        locale,
        onError(error) {
          // eslint-disable-next-line no-console
          console.log(error);
        },
      }),
    [],
  );

  const protocol = location.protocol === 'http:' ? 'ws:' : 'wss:';
  const host = (import.meta.env.VITE_WEBSOCKET_HOST as string) || location.host;

  return (
    <div className={styles.Theme}>
      <I18nContext.Provider value={i18nManager}>
        <AppProvider i18n={enTranslations}>
          <DevConsoleProvider host={`${protocol}//${host}/extensions/`}>
            <DevConsole />
          </DevConsoleProvider>
        </AppProvider>
      </I18nContext.Provider>
    </div>
  );
}

export default App;
