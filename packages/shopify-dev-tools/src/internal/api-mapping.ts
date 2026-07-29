/**
 * Internal-build API mapping: the public SHOPIFY_APIS plus internal-only
 * entries (currently just bourgeois). Mirrors src/types/api-mapping.ts
 * for the public side.
 *
 * dev-mcp's vite.config.js rewrites resolved imports of `…/config/api-mappings`
 * to THIS file when INCLUDE_INTERNAL_APIS=true, producing the internal
 * bundle. The public bundle gets the un-merged public mapping instead.
 *
 * See docs/internal-isolation.md for the full pattern.
 */

import {
  SHOPIFY_APIS as PUBLIC_SHOPIFY_APIS,
  getPublicPackagesList as _getPublicPackagesList,
  getShopifyDevSchemaMap as _getShopifyDevSchemaMap,
  getVersionedApis as _getVersionedApis,
  isVersionedApi as _isVersionedApi,
  type ShopifyAPIs,
} from "../types/api-mapping.js";
import {
  APICategory,
  type APIMapping,
  Visibility,
} from "../types/api-types.js";
import { INTERNAL_API_IDS, type InternalApiIds } from "./api-ids.js";

export const SHOPIFY_APIS: Record<
  ShopifyAPIs | InternalApiIds,
  APIMapping<ShopifyAPIs | InternalApiIds>
> = {
  ...PUBLIC_SHOPIFY_APIS,
  [INTERNAL_API_IDS.BOURGEOIS]: {
    name: INTERNAL_API_IDS.BOURGEOIS,
    displayName: "Bourgeois API",
    description: "Shopify Capital internal financing GraphQL API",
    category: APICategory.GRAPHQL,
    schemaSource: { shopifyDevPrefix: "bourgeois" },
    visibility: Visibility.INTERNAL,
    validation: true,
    gqlSchemaFileName: "bourgeois_unstable.json.gz",
  },
};

/** Internal-build version of getShopifyDevSchemaMap; includes internal entries. */
export function getShopifyDevSchemaMap(): Record<string, string> {
  return _getShopifyDevSchemaMap(SHOPIFY_APIS);
}

/** Internal-build version of getPublicPackagesList; includes internal entries. */
export function getPublicPackagesList(): string[] {
  return _getPublicPackagesList(SHOPIFY_APIS);
}

/** Internal-build version of getVersionedApis; includes internal entries. */
export function getVersionedApis(): ShopifyAPIs[] {
  return _getVersionedApis(SHOPIFY_APIS as Record<string, APIMapping<string>>);
}

/** Internal-build version of isVersionedApi; includes internal entries. */
export function isVersionedApi(apiName: string): boolean {
  return _isVersionedApi(
    apiName,
    SHOPIFY_APIS as Record<string, APIMapping<string>>,
  );
}
