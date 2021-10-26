import React from 'react';

render("Checkout::Feature::Render", App);

function App({ extensionPoint }) {
  return <Text>Welcome to the {extensionPoint} extension!</Text>;
}
