import React from "react";
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
  View
} from "@shopify/app/ui-extensions/post-purchase/react";
extend("Checkout::PostPurchase::ShouldRender", async ({ storage }) => {
  const initialState = await getRenderData();
  const render2 = true;
  if (render2) {
    await storage.update(initialState);
  }
  return {
    render: render2
  };
});
async function getRenderData() {
  return {
    couldBe: "anything"
  };
}
render("Checkout::PostPurchase::Render", App);
export function App({ extensionPoint, storage }) {
  const initialState = storage.initialData;
  return /* @__PURE__ */ React.createElement(BlockStack, {
    spacing: "loose"
  }, /* @__PURE__ */ React.createElement(CalloutBanner, {
    title: "Post-purchase extension template"
  }, "Use this template as a starting point to build a great post-purchase extension."), /* @__PURE__ */ React.createElement(Layout, {
    maxInlineSize: 0.95,
    media: [
      { viewportSize: "small", sizes: [1, 30, 1] },
      { viewportSize: "medium", sizes: [300, 30, 0.5] },
      { viewportSize: "large", sizes: [400, 30, 0.33] }
    ]
  }, /* @__PURE__ */ React.createElement(View, null, /* @__PURE__ */ React.createElement(Image, {
    source: "https://cdn.shopify.com/static/images/examples/img-placeholder-1120x1120.png"
  })), /* @__PURE__ */ React.createElement(View, null), /* @__PURE__ */ React.createElement(BlockStack, {
    spacing: "xloose"
  }, /* @__PURE__ */ React.createElement(TextContainer, null, /* @__PURE__ */ React.createElement(Heading, null, "Post-purchase extension"), /* @__PURE__ */ React.createElement(TextBlock, null, "Here you can cross-sell other products, request a product review based on a previous purchase, and much more.")), /* @__PURE__ */ React.createElement(Button, {
    submit: true,
    onPress: () => {
      console.log(`Extension point ${extensionPoint}`, initialState);
    }
  }, "Primary button"))));
}
