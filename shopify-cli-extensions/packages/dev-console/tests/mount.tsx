import React from 'react';
import {createMount} from '@shopify/react-testing';
import enTranslations from '@shopify/polaris/locales/en.json';
import {AppProvider} from '@shopify/polaris';
import {I18nContext, I18nManager} from '@shopify/react-i18n';
import {DevConsoleContext, DevConsoleContextValue} from '@/dev-console-utils';
import {mockExtensions} from '@/dev-console-utils/testing';

interface MountOptions {
  console?: Partial<DevConsoleContextValue>;
}
interface Context {
  console: DevConsoleContextValue;
}

export const mount = createMount<MountOptions, Context>({
  context(options) {
    const context = {
      console: {
        state: options.console?.state ?? {extensions: mockExtensions()},
        send: options.console?.send ?? jest.fn(),
        addListener: options.console?.addListener ?? jest.fn(),
      },
    };
    return context;
  },
  render(element, context) {
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
          <DevConsoleContext.Provider value={context.console}>
            {element}
          </DevConsoleContext.Provider>
        </AppProvider>
      </I18nContext.Provider>
    );
  }
});
