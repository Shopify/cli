import React from 'react';
import {
  reactExtension,
  useApi,
  Banner,
  useTranslate,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('Checkout::Dynamic::Render', () => <Extension />);

function Extension() {
  const {extensionPoint} = useApi();
  const translate = useTranslate();

  return (
    <Banner title="luxury-trade-ext">
      {translate('welcome', {extensionPoint})}
    </Banner>
  );
}