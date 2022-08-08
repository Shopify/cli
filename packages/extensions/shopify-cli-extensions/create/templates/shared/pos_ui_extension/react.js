import React from 'react';
import {render, useExtensionApi, extend, Tile, Text} from '@shopify/retail-ui-extensions-react';

const Tile = () => {
  const api = useExtensionApi();

  return(
    <>
      <Tile title="My app" subtitle="Welcome to my react app" enabled />
    </>
  );
}

extend('Retail::SmartGrid::Tile', render(Tile));
extend('Retail::SmartGrid::Modal', render(Modal));

const Modal = () => {
  return <Text>Welcome to the extension!</Text>;
}