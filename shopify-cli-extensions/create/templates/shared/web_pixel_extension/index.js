shopify.extend(
  "WebPixel::Render",
  (api) => {
    const { config, subscribe, unsubscribe } = api;
    // Bootstrap and insert pixel script tag here

    // Sample subscribe to page view
    subscribe('pageView', (event) => {

    });
  }
);