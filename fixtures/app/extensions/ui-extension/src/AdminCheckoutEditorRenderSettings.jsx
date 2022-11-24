import React from 'react';

import {
  render,
  Text,
  useExtensionApi,
} from '@shopify/admin-ui-extensions-react'

render('Admin::CheckoutEditor::RenderSettings', () => <App />);

function App() {
  const {extensionPoint} = useExtensionApi();
  return (
    <Text>
      `Welcome to the ${extensionPoint} extension`
    </Text>
  );
}