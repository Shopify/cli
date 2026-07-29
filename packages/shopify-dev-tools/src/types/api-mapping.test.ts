import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  getPublishedSkillName,
  getShopifyDevSchemaMap,
  getVersionedApis,
  isVersionedApi,
  SHOPIFY_APIS,
} from "./api-mapping";
import { APICategory, Visibility, type APIMapping } from "./api-types";

/** APIs that should NOT be versioned. */
const NON_VERSIONED_APIS = [
  "use-shopify-cli",
  "ucp",
  "storefront-web-components",
  "liquid",
  "custom-data",
  "app-store-review",
  "onboarding-dev",
  "onboarding-merchant",
  "polaris-app-home",
] as const;

const INSTRUCTIONS_DIR = path.resolve(import.meta.dirname, "../instructions");

describe("SHOPIFY_APIS registry consistency", () => {
  it("uses the record key as the APIMapping name", () => {
    for (const [key, api] of Object.entries(SHOPIFY_APIS)) {
      expect(api.name, `${key} should use its record key as name`).toBe(key);
    }
  });

  it("has raw instruction markdown for every learnable topic", () => {
    for (const api of Object.values(SHOPIFY_APIS)) {
      if (api.category === APICategory.FUNCTION_GRAPHQL) continue;

      const instructionsPath = path.join(INSTRUCTIONS_DIR, `${api.name}.md`);
      expect(
        existsSync(instructionsPath),
        `${api.name} should have raw instructions at ${instructionsPath}`,
      ).toBe(true);
    }
  });

  it("provides example vector-store queries for searchable learnable topics", () => {
    for (const api of Object.values(SHOPIFY_APIS)) {
      if (api.category === APICategory.FUNCTION_GRAPHQL) continue;
      if (api.searchable === false) continue;

      expect(
        api.exampleVectorStoreQuery,
        `${api.name} is searchable and should provide exampleVectorStoreQuery`,
      ).toBeDefined();
      expect(api.exampleVectorStoreQuery?.query).toBeTruthy();
      expect(api.exampleVectorStoreQuery?.context).toBeTruthy();
    }
  });

  it("publishes unique skill names for generated skills", () => {
    const seen = new Map<string, string>();

    for (const api of Object.values(SHOPIFY_APIS)) {
      if (api.category === APICategory.FUNCTION_GRAPHQL) continue;

      const skillName = getPublishedSkillName(api);
      expect(
        seen.has(skillName),
        `${api.name} resolves to duplicate skill name ${skillName}`,
      ).toBe(false);
      seen.set(skillName, api.name);
    }
  });

  it("sets extension MCP metadata as an all-or-nothing pair", () => {
    for (const api of Object.values(SHOPIFY_APIS)) {
      expect(
        Boolean(api.extensionTypeName),
        `${api.name}: extensionTypeName`,
      ).toBe(Boolean(api.extensionSearchContext));
    }
  });

  it("only enables validation for categories with a validator", () => {
    const validatedCategories = new Set<APICategory>([
      APICategory.GRAPHQL,
      APICategory.FUNCTIONS,
      APICategory.UI_FRAMEWORK,
      APICategory.THEME,
    ]);

    for (const api of Object.values(SHOPIFY_APIS)) {
      if (!api.validation) continue;
      expect(
        validatedCategories.has(api.category),
        `${api.name} sets validation=true but category ${api.category} has no validator`,
      ).toBe(true);
    }
  });
});

describe("SHOPIFY_APIS admin routing descriptions", () => {
  it("keeps use-shopify-cli focused on CLI guidance and operational next steps", () => {
    const { description } = SHOPIFY_APIS["use-shopify-cli"];
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toContain("**Shopify CLI**");
    expect(description).toContain("shopify.app.toml");
    expect(description).toContain("`shopify store auth`");
    expect(description).toContain("`shopify store execute`");
    expect(description).toContain(
      "show/list/find the first 10 products on my store",
    );
    expect(description).toContain("foo.myshopify.com");
    expect(description).toContain("handle, SKU, or location name");
    expect(description).toContain("commands and operational steps");
    expect(description).toContain("API-only understanding or codegen");
    expect(description).toContain(
      "start a Shopify store or try Shopify before they have an account",
    );
    expect(description).toContain(
      "show the first 10 products on `foo.myshopify.com`",
    );
    expect(description).not.toContain("`shopify store create preview`");
  });

  it("keeps plain admin focused on authoring rather than runnable CLI execution", () => {
    const { description } = SHOPIFY_APIS.admin;
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toContain("**Admin GraphQL**");
    expect(description).toContain(
      "**understand, design, or generate** the operation itself",
    );
    expect(description).toContain(
      "**execute** Admin GraphQL **now via Shopify CLI**",
    );
    expect(description).toContain(
      "CLI setup/troubleshooting on store workflows",
    );
    expect(description).toContain("Do **not** choose `admin` first");
    expect(description).toContain("**`use-shopify-cli`**");
    expect(description).toContain("handle/SKU/location lookups");
  });

  it("keeps onboarding-merchant focused on new-merchant preview onboarding and merchant follow-up", () => {
    const { description } = SHOPIFY_APIS["onboarding-merchant"];
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toContain("store owners — not developers");
    expect(description).toContain("start selling online");
    expect(description).toContain("try Shopify before they have an account");
    expect(description).toContain("preview store is created");
    expect(description).toContain("how to keep it, save it, or make it real");
    expect(description).toContain("`shopify store create preview`");
    expect(description).toContain("**`use-shopify-cli`**");
    expect(description).not.toContain("`shopify store execute`");
  });
});

describe("getPublishedSkillName", () => {
  it("defaults to the Shopify-prefixed skill name", () => {
    expect(
      getPublishedSkillName({ name: "admin" } as {
        name: string;
        skillName?: string;
      }),
    ).toBe("shopify-admin");
  });

  it("uses an explicit published skill name override when present", () => {
    expect(
      getPublishedSkillName({
        name: "custom-topic",
        skillName: "custom-skill",
      }),
    ).toBe("custom-skill");
  });
});

describe("getShopifyDevSchemaMap", () => {
  it("returns a mapping from shopify-dev prefixes to dev-mcp API keys", () => {
    const map = getShopifyDevSchemaMap();

    expect(map["admin"]).toBe("admin");
    expect(map["storefront"]).toBe("storefront-graphql");
    expect(map["partner"]).toBe("partner");
    expect(map["customer"]).toBe("customer");
    expect(map["payments_apps"]).toBe("payments-apps");
  });

  it("includes function schema mappings", () => {
    const map = getShopifyDevSchemaMap();

    expect(map["functions_discount_schema"]).toBe("functions_discount");
    expect(map["functions_cart_transform_schema"]).toBe(
      "functions_cart_transform",
    );
    expect(map["functions_cart_checkout_validation_schema"]).toBe(
      "functions_cart_checkout_validation",
    );
  });

  it("does not include APIs without schemaSource", () => {
    const map = getShopifyDevSchemaMap();

    expect(Object.values(map)).not.toContain("functions");
    expect(Object.values(map)).not.toContain("polaris-app-home");
  });

  it("only contains entries for APIs with shopifyDevPrefix", () => {
    const map = getShopifyDevSchemaMap();
    const apisWithPrefix = Object.values(SHOPIFY_APIS).filter(
      (api) => api.schemaSource?.shopifyDevPrefix,
    );

    expect(Object.keys(map)).toHaveLength(apisWithPrefix.length);
  });
});

describe("SHOPIFY_APIS schemaSource", () => {
  it("all GraphQL APIs have a shopifyDevPrefix", () => {
    const graphqlApis = Object.values(SHOPIFY_APIS).filter(
      (api) => api.category === "graphql",
    );

    for (const api of graphqlApis) {
      expect(
        api.schemaSource?.shopifyDevPrefix,
        `${api.name} should have shopifyDevPrefix`,
      ).toBeDefined();
    }
  });

  it("all function-graphql APIs have a shopifyDevPrefix", () => {
    const functionApis = Object.values(SHOPIFY_APIS).filter(
      (api) => api.category === "function-graphql",
    );

    for (const api of functionApis) {
      expect(
        api.schemaSource?.shopifyDevPrefix,
        `${api.name} should have shopifyDevPrefix`,
      ).toBeDefined();
    }
  });

  it("liquid API has npmPackage schema source", () => {
    const liquid = SHOPIFY_APIS["liquid"];
    expect(liquid.schemaSource?.npmPackage).toBe("@shopify/theme-check-common");
  });
});

describe("versioned API metadata", () => {
  it("every API is explicitly versioned or known non-versioned", () => {
    const allApis = Object.keys(SHOPIFY_APIS);
    const versionedSet = new Set<string>(getVersionedApis());
    const nonVersionedSet = new Set<string>(NON_VERSIONED_APIS);

    for (const apiName of allApis) {
      const isVersioned = versionedSet.has(apiName);
      const isNonVersioned = nonVersionedSet.has(apiName);
      expect(
        isVersioned || isNonVersioned,
        `${apiName} is neither versioned nor in the known non-versioned list — add versioned: true or add to NON_VERSIONED_APIS`,
      ).toBe(true);
      expect(
        !(isVersioned && isNonVersioned),
        `${apiName} is both versioned and in the non-versioned list — pick one`,
      ).toBe(true);
    }
  });

  it("non-versioned APIs do not set versioned: true", () => {
    for (const apiName of NON_VERSIONED_APIS) {
      const api = SHOPIFY_APIS[apiName as keyof typeof SHOPIFY_APIS];
      expect(
        api?.versioned,
        `${apiName} is in NON_VERSIONED_APIS but has versioned: true`,
      ).toBeFalsy();
    }
  });
});

/** Minimal valid APIMapping for unit tests that don't depend on registry data. */
function stubApi(
  overrides: Partial<APIMapping<string>> & { name: string },
): APIMapping<string> {
  return {
    displayName: overrides.name,
    description: "",
    category: APICategory.GRAPHQL,
    visibility: Visibility.PUBLIC,
    ...overrides,
  };
}

describe("getVersionedApis", () => {
  it("returns only APIs with versioned: true", () => {
    const apis: Record<string, APIMapping<string>> = {
      versioned: stubApi({ name: "versioned", versioned: true }),
      unversioned: stubApi({ name: "unversioned" }),
    };

    expect(getVersionedApis(apis)).toEqual(["versioned"]);
  });
});

describe("isVersionedApi", () => {
  it("returns true for versioned APIs", () => {
    expect(isVersionedApi("admin")).toBe(true);
    expect(isVersionedApi("storefront-graphql")).toBe(true);
    expect(isVersionedApi("polaris-checkout-extensions")).toBe(true);
    expect(isVersionedApi("hydrogen")).toBe(true);
    expect(isVersionedApi("functions_discount")).toBe(true);
  });

  it("returns false for non-versioned APIs", () => {
    expect(isVersionedApi("liquid")).toBe(false);
    expect(isVersionedApi("custom-data")).toBe(false);
    expect(isVersionedApi("use-shopify-cli")).toBe(false);
    expect(isVersionedApi("storefront-web-components")).toBe(false);
    expect(isVersionedApi("app-store-review")).toBe(false);
  });

  it("returns false for unknown APIs", () => {
    expect(isVersionedApi("nonexistent")).toBe(false);
  });
});
