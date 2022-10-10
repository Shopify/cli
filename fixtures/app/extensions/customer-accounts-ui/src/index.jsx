import React from 'react';
import {render, Banner} from '@shopify/customer-account-ui-extensions-react';
import en from "../locales/en.default.json";

render('CustomerAccount::FullPage::RenderWithin', () => <App />);

function App() {
  // Please note, using `en.welcome` is just an interim solution,
  // until we added i18n support in the `ui-extension` library for 'customer-accounts-ui' extensions.
  return <Banner>{`Welcome: ${en.welcome}`}</Banner>;
}
