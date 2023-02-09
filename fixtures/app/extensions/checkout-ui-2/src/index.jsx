import React from 'react';
import {useExtensionApi, render, Banner, Heading, TextBlock, View, BlockLayout, Text} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Contact::RenderAfter', () => <App />);

function App() {
  const {extensionPoint, i18n} = useExtensionApi();
  return (
    <BlockLayout rows={[80, 'fill']}>
      <View border="none" padding="base">
      <TextBlock size="extraLarge" appearance="critical">These are the best emojis for you!</TextBlock>
      <TextBlock size="small" appearance="critical">Come back tomorrow for a new emoji selection.</TextBlock>
      </View>
      <View border="none" padding="base">
      <Heading>
        <Text size="extraLarge">🤩 🚀 🙈</Text>
      </Heading>
      </View>
    </BlockLayout>
  );
}
