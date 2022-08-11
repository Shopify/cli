import { extend, Text } from "@shopify/retail-ui-extensions";

extend('Retail::SmartGrid::Tile', (root, api) => {
  const tileProps = {
    title: 'My app',
    subtitle: 'A test app',
    enabled: true,
    onPress: () => {
      api.navigation.navigateToFullScreenModal();
    }
  }

  const tile = root.createComponent('Tile', tileProps);

  root.appendChild(tile);
  root.mount();
});

extend('Retail::SmartGrid::Modal', (root, api) => {
  root.appendChild(
    root.createComponent(
      Text,
      {},
      `Welcome to the ${api.extensionPoint} extension surface!`
    )
  );
  root.mount();
});