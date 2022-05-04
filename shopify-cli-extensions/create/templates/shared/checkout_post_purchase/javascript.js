/**
 * Extend Shopify Checkout with a custom Post Purchase user experience This
 * Shopify Checkout template provides two extension points:
 *  1. ShouldRender - Called first, during the checkout process.
 *  2. Render - If requested by `ShouldRender`, will be rendered after checkout
 *     completes
 */

import {
  extend,
  BlockStack,
  Button,
  Heading,
  Image,
  Layout,
  TextBlock,
  TextContainer,
  CalloutBanner,
  View,
} from {{ if .UsesNext }}"@shopify/app/ui-extensions/post-purchase"{{ else }}"@shopify/post-purchase-ui-extensions"{{ end }};

{{ file "shared/checkout_post_purchase/javascript.body.js" }}