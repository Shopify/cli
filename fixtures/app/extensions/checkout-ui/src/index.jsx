import React from 'react';
import {useExtensionApi, render, Banner, useSettings} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Dynamic::Render', () => <App />);

function App() {
  // Use the merchant-defined settings to retrieve the extension's content
  const {title, description, collapsible, status: merchantStatus} = useSettings();

  // Set a default status for the banner if a merchant didn't configure the banner in the checkout editor
  const status = merchantStatus ?? 'info';

  // Render the banner
  return (
    <Banner title={title} status={status} collapsible={collapsible}>
      {description}
    </Banner>
  );
}
