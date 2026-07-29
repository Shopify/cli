import { DocumentNode, Kind, OperationTypeNode } from "graphql";
import { describe, expect, it } from "vitest";
import {
  analyzeRequiredOfflineScopes,
  getRootTypeName,
} from "./offlineScopes.js";
import type { OfflineScopeData } from "./types.js";

// Pre-parsed mock queries as DocumentNode objects
const mockQueries = {
  getProducts: {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: "query",
        name: { kind: Kind.NAME, value: "GetProducts" },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "products" },
              arguments: [
                {
                  kind: Kind.ARGUMENT,
                  name: { kind: Kind.NAME, value: "first" },
                  value: { kind: Kind.INT, value: "5" },
                },
              ],
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: { kind: Kind.NAME, value: "nodes" },
                    selectionSet: {
                      kind: Kind.SELECTION_SET,
                      selections: [
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "id" },
                        },
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "title" },
                        },
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "status" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  } as DocumentNode,

  getCustomers: {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: "query",
        name: { kind: Kind.NAME, value: "GetCustomers" },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "customers" },
              arguments: [
                {
                  kind: Kind.ARGUMENT,
                  name: { kind: Kind.NAME, value: "first" },
                  value: { kind: Kind.INT, value: "10" },
                },
              ],
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: { kind: Kind.NAME, value: "nodes" },
                    selectionSet: {
                      kind: Kind.SELECTION_SET,
                      selections: [
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "id" },
                        },
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "email" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  } as DocumentNode,

  createCustomer: {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: "mutation",
        name: { kind: Kind.NAME, value: "CreateCustomer" },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "customerCreate" },
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: { kind: Kind.NAME, value: "customer" },
                    selectionSet: {
                      kind: Kind.SELECTION_SET,
                      selections: [
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "id" },
                        },
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "email" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  } as DocumentNode,

  withFragment: {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.FRAGMENT_DEFINITION,
        name: { kind: Kind.NAME, value: "ProductFields" },
        typeCondition: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: "Product" },
        },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "id" },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "title" },
            },
          ],
        },
      },
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: "query",
        name: { kind: Kind.NAME, value: "GetProductsWithFragment" },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "products" },
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: { kind: Kind.NAME, value: "nodes" },
                    selectionSet: {
                      kind: Kind.SELECTION_SET,
                      selections: [
                        {
                          kind: Kind.FRAGMENT_SPREAD,
                          name: { kind: Kind.NAME, value: "ProductFields" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  } as DocumentNode,

  withInlineFragment: {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: "query",
        name: { kind: Kind.NAME, value: "GetNodes" },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: "nodes" },
              arguments: [
                {
                  kind: Kind.ARGUMENT,
                  name: { kind: Kind.NAME, value: "ids" },
                  value: {
                    kind: Kind.LIST,
                    values: [
                      { kind: Kind.STRING, value: "gid://shopify/Product/1" },
                    ],
                  },
                },
              ],
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: { kind: Kind.NAME, value: "id" },
                  },
                  {
                    kind: Kind.INLINE_FRAGMENT,
                    typeCondition: {
                      kind: Kind.NAMED_TYPE,
                      name: { kind: Kind.NAME, value: "Product" },
                    },
                    selectionSet: {
                      kind: Kind.SELECTION_SET,
                      selections: [
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "title" },
                        },
                        {
                          kind: Kind.FIELD,
                          name: { kind: Kind.NAME, value: "vendor" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  } as DocumentNode,
};

// Mock offline scope data
const mockOfflineScopeData: OfflineScopeData = {
  items: [
    // Type-level scopes
    {
      type: "type",
      typeName: "QueryRoot",
      requiredAccess: "read_products",
      offlineScopes: ["root"],
    },
    {
      type: "type",
      typeName: "Mutation",
      requiredAccess: "write_customers",
      offlineScopes: ["mutations"],
    },
    {
      type: "type",
      typeName: "Product",
      requiredAccess: "read_products",
      offlineScopes: ["products"],
    },
    {
      type: "type",
      typeName: "ProductConnection",
      requiredAccess: "read_products",
      offlineScopes: ["product_connection"],
    },
    {
      type: "type",
      typeName: "Customer",
      requiredAccess: "read_customers",
      offlineScopes: ["customers"],
    },
    {
      type: "type",
      typeName: "CustomerConnection",
      requiredAccess: "read_customers",
      offlineScopes: ["customer_connection"],
    },
    {
      type: "type",
      typeName: "Order",
      requiredAccess: "read_orders",
      offlineScopes: ["orders"],
    },
    {
      type: "type",
      typeName: "Shop",
      requiredAccess: "read_shop",
      offlineScopes: ["shop"],
    },
    {
      type: "type",
      typeName: "SubscriptionContract",
      requiredAccess: "read_subscription_contracts",
      offlineScopes: ["subscription_contracts"],
    },
    {
      type: "type",
      typeName: "Node",
      requiredAccess: "read_all",
      offlineScopes: ["nodes"],
    },

    // Field-level scopes
    {
      type: "field",
      typeName: "QueryRoot",
      fieldName: "products",
      returnType: "ProductConnection",
      requiredAccess: "read_products",
      offlineScopes: ["read_products"],
    },
    {
      type: "field",
      typeName: "QueryRoot",
      fieldName: "customers",
      returnType: "CustomerConnection",
      requiredAccess: "read_customers",
      offlineScopes: ["read_customers"],
    },
    {
      type: "field",
      typeName: "QueryRoot",
      fieldName: "orders",
      returnType: "OrderConnection",
      requiredAccess: "read_orders",
      offlineScopes: ["read_orders"],
    },
    {
      type: "field",
      typeName: "QueryRoot",
      fieldName: "shop",
      returnType: "Shop",
      requiredAccess: "read_shop",
      offlineScopes: ["read_shop"],
    },
    {
      type: "field",
      typeName: "QueryRoot",
      fieldName: "subscriptionContracts",
      returnType: "SubscriptionContractConnection",
      requiredAccess: "read_subscription_contracts",
      offlineScopes: ["read_subscriptions"],
    },
    {
      type: "field",
      typeName: "QueryRoot",
      fieldName: "nodes",
      returnType: "Node",
      requiredAccess: "read_all",
      offlineScopes: ["read_nodes"],
    },
    {
      type: "field",
      typeName: "Mutation",
      fieldName: "productCreate",
      returnType: "ProductCreatePayload",
      requiredAccess: "write_products",
      offlineScopes: ["write_products"],
    },
    {
      type: "field",
      typeName: "Mutation",
      fieldName: "customerCreate",
      returnType: "CustomerCreatePayload",
      requiredAccess: "write_customers",
      offlineScopes: ["write_customers"],
    },
    {
      type: "field",
      typeName: "ProductConnection",
      fieldName: "nodes",
      returnType: "Product",
      requiredAccess: "read_products",
      offlineScopes: ["product_nodes"],
    },
    {
      type: "field",
      typeName: "CustomerConnection",
      fieldName: "nodes",
      returnType: "Customer",
      requiredAccess: "read_customers",
      offlineScopes: ["customer_nodes"],
    },
    {
      type: "field",
      typeName: "OrderConnection",
      fieldName: "nodes",
      returnType: "Order",
      requiredAccess: "read_orders",
      offlineScopes: ["order_nodes"],
    },
    {
      type: "field",
      typeName: "SubscriptionContractConnection",
      fieldName: "nodes",
      returnType: "SubscriptionContract",
      requiredAccess: "read_subscription_contracts",
      offlineScopes: ["subscription_nodes"],
    },
    {
      type: "field",
      typeName: "Product",
      fieldName: "collections",
      returnType: "CollectionConnection",
      requiredAccess: "read_product_listings",
      offlineScopes: ["product_collections"],
    },
    {
      type: "field",
      typeName: "CustomerCreatePayload",
      fieldName: "customer",
      returnType: "Customer",
      requiredAccess: "write_customers",
      offlineScopes: ["created_customer"],
    },
    {
      type: "field",
      typeName: "ProductCreatePayload",
      fieldName: "product",
      returnType: "Product",
      requiredAccess: "write_products",
      offlineScopes: ["created_product"],
    },
  ],
};

describe("Offline Scope Analyzer", () => {
  describe("Basic scope extraction", () => {
    it("extracts scopes from product queries", async () => {
      const scopes = await analyzeRequiredOfflineScopes(
        mockQueries.getProducts,
        mockOfflineScopeData,
      );

      expect(scopes).toContain("root");
      expect(scopes).toContain("read_products");
      expect(scopes).toContain("product_connection");
      expect(scopes).toContain("product_nodes");
      expect(scopes).toContain("products");
    });

    it("extracts scopes from customer queries", async () => {
      const scopes = await analyzeRequiredOfflineScopes(
        mockQueries.getCustomers,
        mockOfflineScopeData,
      );

      expect(scopes).toContain("root");
      expect(scopes).toContain("read_customers");
      expect(scopes).toContain("customer_connection");
      expect(scopes).toContain("customer_nodes");
      expect(scopes).toContain("customers");
    });

    it("handles mutations correctly", async () => {
      const scopes = await analyzeRequiredOfflineScopes(
        mockQueries.createCustomer,
        mockOfflineScopeData,
      );

      expect(scopes).toContain("mutations");
      expect(scopes).toContain("write_customers");
      expect(scopes).toContain("created_customer");
      expect(scopes).toContain("customers");
    });

    it("handles fragments", async () => {
      const scopes = await analyzeRequiredOfflineScopes(
        mockQueries.withFragment,
        mockOfflineScopeData,
      );

      expect(scopes).toContain("root");
      expect(scopes).toContain("read_products");
      expect(scopes).toContain("product_connection");
      expect(scopes).toContain("product_nodes");
      expect(scopes).toContain("products");
    });

    it("handles inline fragments", async () => {
      const scopes = await analyzeRequiredOfflineScopes(
        mockQueries.withInlineFragment,
        mockOfflineScopeData,
      );

      expect(scopes).toContain("root");
      expect(scopes).toContain("read_nodes");
      expect(scopes).toContain("nodes");
      expect(scopes).toContain("products"); // From inline fragment
    });

    it("deduplicates scopes", async () => {
      // Create a query that would result in duplicate scopes
      const queryWithDuplicates: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OPERATION_DEFINITION,
            operation: "query" as OperationTypeNode,
            name: { kind: Kind.NAME, value: "GetProductsTwice" },
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: "products" },
                  selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                      {
                        kind: Kind.FIELD,
                        name: { kind: Kind.NAME, value: "nodes" },
                      },
                    ],
                  },
                },
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: "products" },
                  selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                      {
                        kind: Kind.FIELD,
                        name: { kind: Kind.NAME, value: "nodes" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      };

      const scopes = await analyzeRequiredOfflineScopes(
        queryWithDuplicates,
        mockOfflineScopeData,
      );

      // Check that each scope appears only once
      const scopeSet = new Set(scopes);
      expect(scopeSet.size).toBe(scopes.length);
      expect(scopes).toContain("read_products");
      expect(scopes).toContain("product_connection");
    });
  });

  describe("getRootTypeName", () => {
    describe("Admin API behavior", () => {
      it("returns QueryRoot for admin queries", () => {
        expect(getRootTypeName("query", "admin")).toBe("QueryRoot");
      });

      it("returns Mutation for admin mutations", () => {
        expect(getRootTypeName("mutation", "admin")).toBe("Mutation");
      });

      it("returns QueryRoot for admin subscriptions", () => {
        expect(getRootTypeName("subscription", "admin")).toBe("QueryRoot");
      });

      it("defaults to admin schema when no schema provided", () => {
        expect(getRootTypeName("query")).toBe("QueryRoot");
        expect(getRootTypeName("mutation")).toBe("Mutation");
        expect(getRootTypeName("subscription")).toBe("QueryRoot");
      });
    });

    describe("Non-admin API behavior", () => {
      it("returns Query for non-admin queries", () => {
        expect(getRootTypeName("query", "storefront")).toBe("Query");
        expect(getRootTypeName("query", "customer")).toBe("Query");
        expect(getRootTypeName("query", "partner")).toBe("Query");
      });

      it("returns Mutation for non-admin mutations", () => {
        expect(getRootTypeName("mutation", "storefront")).toBe("Mutation");
        expect(getRootTypeName("mutation", "customer")).toBe("Mutation");
        expect(getRootTypeName("mutation", "partner")).toBe("Mutation");
      });

      it("returns Query for non-admin subscriptions", () => {
        expect(getRootTypeName("subscription", "storefront")).toBe("Query");
        expect(getRootTypeName("subscription", "customer")).toBe("Query");
        expect(getRootTypeName("subscription", "partner")).toBe("Query");
      });
    });

    describe("Edge cases", () => {
      it("handles case-sensitive operation names", () => {
        // The function checks exact string match for "mutation"
        expect(getRootTypeName("MUTATION", "admin")).toBe("QueryRoot");
        expect(getRootTypeName("Mutation", "admin")).toBe("QueryRoot");
        expect(getRootTypeName("QUERY", "admin")).toBe("QueryRoot");
        expect(getRootTypeName("Query", "admin")).toBe("QueryRoot");
      });

      it("handles unknown operation types", () => {
        expect(getRootTypeName("unknown", "admin")).toBe("QueryRoot");
        expect(getRootTypeName("", "admin")).toBe("QueryRoot");
        expect(getRootTypeName("null", "admin")).toBe("QueryRoot");
      });

      it("handles empty schema name", () => {
        expect(getRootTypeName("query", "")).toBe("Query");
        expect(getRootTypeName("mutation", "")).toBe("Mutation");
      });

      it("handles special characters in schema name", () => {
        expect(getRootTypeName("query", "admin-v2")).toBe("Query");
        expect(getRootTypeName("mutation", "admin.v2")).toBe("Mutation");
        expect(getRootTypeName("query", "admin_v2")).toBe("Query");
      });

      it("handles exact admin match only", () => {
        expect(getRootTypeName("query", "admin2")).toBe("Query");
        expect(getRootTypeName("query", "adminAPI")).toBe("Query");
        expect(getRootTypeName("query", "my-admin")).toBe("Query");
        expect(getRootTypeName("query", "admin-api")).toBe("Query");
      });
    });
  });
});
