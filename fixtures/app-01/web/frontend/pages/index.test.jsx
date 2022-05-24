import { describe, it, expect, vi } from "vitest";
import { Link } from "@shopify/polaris";

import { mount } from "test/mount";
import Index from "./index";
import { ProductsCard } from "components/ProductsCard";

vi.mock("components/ProductsCard", () => ({
  ProductsCard: () => null,
}));

it("renders links to documentation", async () => {
  const component = await mount(<Index />);

  expect(component).toContainReactComponent(Link, {
    url: "https://polaris.shopify.com/",
    external: true,
  });

  expect(component).toContainReactComponent(Link, {
    url: "https://shopify.dev/api/admin-graphql",
    external: true,
  });

  expect(component).toContainReactComponent(Link, {
    url: "https://shopify.dev/apps/tools/app-bridge",
    external: true,
  });

  expect(component).toContainReactComponent(Link, {
    url: "https://shopify.dev/apps/getting-started/add-functionality",
    external: true,
  });
});

it("renders a <ProductsCard/>", async () => {
  const component = await mount(<Index />);

  expect(component).toContainReactComponent(ProductsCard);
});