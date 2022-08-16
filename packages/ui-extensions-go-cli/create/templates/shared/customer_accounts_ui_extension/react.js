import React from 'react';
import {render, Banner} from '@shopify/customer-account-ui-extensions-react';

render('CustomerAccount::FullPage::RenderWithin', () => <App />);

function App() {
  return <Banner>Welcome</Banner>;
}
