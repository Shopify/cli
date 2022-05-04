/**
 * Extend Shopify Checkout with a custom Post Purchase user experience.
 * This template provides two extension points:
 *
 *  1. ShouldRender - Called first, during the checkout process, when the
 *     payment page loads.
 *  2. Render - If requested by `ShouldRender`, will be rendered after checkout
 *     completes
 */
import React from 'react';

import {
  extend,
  render,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  TextBlock,
  TextContainer,
  View,
} from {{ if .UsesNext }}"@shopify/app/ui-extensions/post-purchase/react"{{ else }}"@shopify/post-purchase-ui-extensions-react"{{ end }};

{{ file "shared/checkout_post_purchase/react.body.js" }}