/**
 * HTTP utilities for making requests to Shopify dev server
 */

const PROD_BASE_URL = "https://shopify.dev/";
const SHOP_DEV_BASE_URL = "https://shopify-dev.shop.dev/";

function stagingHost(serverNumber: number): string {
  return `https://shopify-dev-staging${serverNumber}.shopifycloud.com/`;
}

/**
 * Resolves which Shopify dev host the next request should hit.
 *
 * Precedence (highest first):
 *   1. SHOPIFY_DEV_STAGING_SERVER_NUMBER — route to a Minerva-fronted staging
 *      server. MINERVA_TOKEN must also be set; we throw if it isn't, rather
 *      than silently falling through to prod with a redirect-to-login body.
 *   2. SHOPIFY_DEV_INSTRUMENTATION_URL — base-URL override scoped to the
 *      /mcp/usage path only. Used by the evals harness to black-hole
 *      telemetry without affecting real search calls.
 *   3. DEV=true (anything truthy other than the literal string "false") —
 *      https://shopify-dev.shop.dev/.
 *   4. Default — https://shopify.dev/.
 *
 * @internal
 */
export function resolveShopifyDevBaseUrl(options?: {
  /** The request URI, used to scope SHOPIFY_DEV_INSTRUMENTATION_URL to /mcp/usage. */
  uri?: string;
  /** Env source. Defaults to process.env; passing an object makes tests deterministic. */
  env?: NodeJS.ProcessEnv;
}): { url: string; headers: Record<string, string> } {
  const env = options?.env ?? process.env;
  const stagingRaw = env.SHOPIFY_DEV_STAGING_SERVER_NUMBER?.trim();

  if (stagingRaw) {
    // Strict: digits only. Number.parseInt would accept "2.example.com" as 2.
    if (!/^\d+$/.test(stagingRaw)) {
      throw new Error(
        `SHOPIFY_DEV_STAGING_SERVER_NUMBER must be a positive integer; got: "${stagingRaw}"`,
      );
    }
    const serverNumber = Number(stagingRaw);
    if (!Number.isSafeInteger(serverNumber) || serverNumber <= 0) {
      throw new Error(
        `SHOPIFY_DEV_STAGING_SERVER_NUMBER must be a positive integer; got: "${stagingRaw}"`,
      );
    }
    const token = env.MINERVA_TOKEN;
    if (!token) {
      const audience = stagingHost(serverNumber).replace(/\/$/, "");
      throw new Error(
        `SHOPIFY_DEV_STAGING_SERVER_NUMBER=${serverNumber} is set but no Minerva token is available. ` +
          `Staging servers are behind Minerva. Get a token via:\n` +
          `  export MINERVA_TOKEN=$(devx minerva-auth --client-id 0oa1bphetnkOusboI0x8 --audience ${audience})`,
      );
    }
    return {
      url: stagingHost(serverNumber),
      headers: { Cookie: `MINERVA_TOKEN=${token}` },
    };
  }

  const instrumentationOverride = env.SHOPIFY_DEV_INSTRUMENTATION_URL?.trim();
  if (instrumentationOverride && options?.uri?.startsWith("/mcp/usage")) {
    return { url: instrumentationOverride, headers: {} };
  }

  if (env.DEV && env.DEV !== "false") {
    return { url: SHOP_DEV_BASE_URL, headers: {} };
  }

  return { url: PROD_BASE_URL, headers: {} };
}

/**
 * Options for shopifyDevFetch
 */
export interface ShopifyDevFetchOptions {
  /** Query parameters to add to the URL */
  parameters?: Record<string, string>;
  /** Additional headers to include in the request */
  headers?: Record<string, string>;
  /** HTTP method (default: GET) */
  method?: string;
  /** Request body */
  body?: string;
  /** Instrumentation data for tracking */
  instrumentation?: {
    packageVersion?: string;
    timestamp?: string;
  };
}

/**
 * Helper function to make requests to the Shopify dev server
 * @param uri The API path or full URL (e.g., "/assistant/search", "/mcp/getting_started")
 * @param options Request options including parameters and headers
 * @returns The response text
 * @throws Error if the response is not ok
 */
export async function shopifyDevFetch(
  uri: string,
  options?: ShopifyDevFetchOptions,
): Promise<string> {
  let url: URL;
  let resolvedHeaders: Record<string, string> = {};

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    url = new URL(uri);
  } else {
    const resolved = resolveShopifyDevBaseUrl({ uri });
    url = new URL(uri, resolved.url);
    resolvedHeaders = resolved.headers;
  }

  // Add query parameters
  if (options?.parameters) {
    Object.entries(options.parameters).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: options?.method || "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "X-Shopify-Surface": "mcp",
      "X-Shopify-MCP-Version": options?.instrumentation?.packageVersion || "",
      "X-Shopify-Timestamp": options?.instrumentation?.timestamp || "",
      ...resolvedHeaders,
      ...options?.headers,
    },
    ...(options?.body && { body: options.body }),
  });

  if (!response.ok) {
    let errorBody: string | undefined;
    try {
      errorBody = await response.text();
    } catch {
      // Body unreadable — fall through to status-only message.
    }
    throw new Error(
      errorBody
        ? `HTTP ${response.status}: ${errorBody}`
        : `HTTP error! status: ${response.status}`,
    );
  }

  return await response.text();
}
