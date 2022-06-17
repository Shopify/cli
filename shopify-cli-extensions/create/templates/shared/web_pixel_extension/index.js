shopify.extend(
  "WebPixel::Render",
  (api) => {
    const { analytics, context, configuration } = api;
    // Bootstrap and insert pixel script tag here

    // Sample subscribe to page view
    analytics.subscribe('pageView', (event) => {
     
    });
  }
);