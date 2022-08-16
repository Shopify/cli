import {register} from "@shopify/web-pixels-extension";

register(({ configuration, analytics, browser }) => {
    // Bootstrap and insert pixel script tag here

    // Sample subscribe to page view
    analytics.subscribe('page_viewed', (event) => {
      console.log('Page viewed', event);
    });
});
