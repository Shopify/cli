import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveShopifyDevBaseUrl,
  shopifyDevFetch,
  type ShopifyDevFetchOptions,
} from "./index.js";

const STAGING_KEY = "SHOPIFY_DEV_STAGING_SERVER_NUMBER";
const TOKEN_KEY = "MINERVA_TOKEN";
const INSTR_URL_KEY = "SHOPIFY_DEV_INSTRUMENTATION_URL";

describe("resolveShopifyDevBaseUrl", () => {
  it("returns the prod URL with no env overrides", () => {
    expect(resolveShopifyDevBaseUrl({ env: {} })).toEqual({
      url: "https://shopify.dev/",
      headers: {},
    });
  });

  it("returns shop.dev when DEV is truthy", () => {
    expect(resolveShopifyDevBaseUrl({ env: { DEV: "true" } })).toEqual({
      url: "https://shopify-dev.shop.dev/",
      headers: {},
    });
    expect(resolveShopifyDevBaseUrl({ env: { DEV: "1" } }).url).toBe(
      "https://shopify-dev.shop.dev/",
    );
  });

  it("treats DEV=false as the default (prod)", () => {
    expect(resolveShopifyDevBaseUrl({ env: { DEV: "false" } }).url).toBe(
      "https://shopify.dev/",
    );
  });

  it("routes to the Minerva-fronted staging host when SHOPIFY_DEV_STAGING_SERVER_NUMBER is set", () => {
    const result = resolveShopifyDevBaseUrl({
      env: { [STAGING_KEY]: "3", [TOKEN_KEY]: "jwt.value.here" },
    });
    expect(result).toEqual({
      url: "https://shopify-dev-staging3.shopifycloud.com/",
      headers: { Cookie: "MINERVA_TOKEN=jwt.value.here" },
    });
  });

  it("throws when staging is set without a Minerva token", () => {
    expect(() =>
      resolveShopifyDevBaseUrl({ env: { [STAGING_KEY]: "5" } }),
    ).toThrow(/no Minerva token is available/);
  });

  it("throws when staging server number is not a positive integer", () => {
    expect(() =>
      resolveShopifyDevBaseUrl({
        env: { [STAGING_KEY]: "abc", [TOKEN_KEY]: "t" },
      }),
    ).toThrow(/must be a positive integer/);
    expect(() =>
      resolveShopifyDevBaseUrl({
        env: { [STAGING_KEY]: "0", [TOKEN_KEY]: "t" },
      }),
    ).toThrow(/must be a positive integer/);
    expect(() =>
      resolveShopifyDevBaseUrl({
        env: { [STAGING_KEY]: "-1", [TOKEN_KEY]: "t" },
      }),
    ).toThrow(/must be a positive integer/);
  });

  it("rejects values that Number.parseInt would have salvaged (e.g. '2.example.com', '2.5', '1e2')", () => {
    // Number.parseInt("2.example.com", 10) === 2, which would silently route
    // to staging server 2. The stricter ^\d+$ check rejects it instead.
    expect(() =>
      resolveShopifyDevBaseUrl({
        env: { [STAGING_KEY]: "2.example.com", [TOKEN_KEY]: "t" },
      }),
    ).toThrow(/must be a positive integer/);
    expect(() =>
      resolveShopifyDevBaseUrl({
        env: { [STAGING_KEY]: "2.5", [TOKEN_KEY]: "t" },
      }),
    ).toThrow(/must be a positive integer/);
    expect(() =>
      resolveShopifyDevBaseUrl({
        env: { [STAGING_KEY]: "1e2", [TOKEN_KEY]: "t" },
      }),
    ).toThrow(/must be a positive integer/);
  });

  it("treats an empty SHOPIFY_DEV_STAGING_SERVER_NUMBER as unset", () => {
    expect(
      resolveShopifyDevBaseUrl({ env: { [STAGING_KEY]: "   " } }).url,
    ).toBe("https://shopify.dev/");
  });

  it("scopes SHOPIFY_DEV_INSTRUMENTATION_URL to /mcp/usage paths only", () => {
    const env = { [INSTR_URL_KEY]: "http://127.0.0.1:0/" };
    expect(resolveShopifyDevBaseUrl({ env, uri: "/mcp/usage" }).url).toBe(
      "http://127.0.0.1:0/",
    );
    expect(
      resolveShopifyDevBaseUrl({ env, uri: "/assistant/search" }).url,
    ).toBe("https://shopify.dev/");
  });

  it("prefers staging over SHOPIFY_DEV_INSTRUMENTATION_URL on /mcp/usage", () => {
    const result = resolveShopifyDevBaseUrl({
      env: {
        [STAGING_KEY]: "2",
        [TOKEN_KEY]: "t",
        [INSTR_URL_KEY]: "http://127.0.0.1:0/",
      },
      uri: "/mcp/usage",
    });
    expect(result.url).toBe("https://shopify-dev-staging2.shopifycloud.com/");
  });

  it("prefers staging over DEV", () => {
    const result = resolveShopifyDevBaseUrl({
      env: { [STAGING_KEY]: "4", [TOKEN_KEY]: "t", DEV: "true" },
    });
    expect(result.url).toBe("https://shopify-dev-staging4.shopifycloud.com/");
  });
});

describe("shopifyDevFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalEnv = {
    [STAGING_KEY]: process.env[STAGING_KEY],
    [TOKEN_KEY]: process.env[TOKEN_KEY],
    [INSTR_URL_KEY]: process.env[INSTR_URL_KEY],
    DEV: process.env.DEV,
  };

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    // Scrub env so shadowenv-set DEV doesn't leak into assertions
    delete process.env[STAGING_KEY];
    delete process.env[TOKEN_KEY];
    delete process.env[INSTR_URL_KEY];
    delete process.env.DEV;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function lastCall(): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    return { url, init };
  }

  function headersOf(init: RequestInit): Record<string, string> {
    return init.headers as Record<string, string>;
  }

  it("hits the prod URL by default", async () => {
    await shopifyDevFetch("/assistant/search");
    expect(lastCall().url).toBe("https://shopify.dev/assistant/search");
  });

  it("injects the Minerva Cookie when staging is configured", async () => {
    process.env[STAGING_KEY] = "3";
    process.env[TOKEN_KEY] = "jwt.value.here";

    await shopifyDevFetch("/assistant/search", {
      method: "POST",
      body: "{}",
    } satisfies ShopifyDevFetchOptions);

    const { url, init } = lastCall();
    expect(url).toBe(
      "https://shopify-dev-staging3.shopifycloud.com/assistant/search",
    );
    expect(headersOf(init).Cookie).toBe("MINERVA_TOKEN=jwt.value.here");
  });

  it("lets caller headers override resolved headers", async () => {
    process.env[STAGING_KEY] = "3";
    process.env[TOKEN_KEY] = "jwt.value.here";

    await shopifyDevFetch("/x", {
      headers: { Cookie: "MINERVA_TOKEN=override" },
    });
    expect(headersOf(lastCall().init).Cookie).toBe("MINERVA_TOKEN=override");
  });

  it("lets caller override X-Shopify-Surface", async () => {
    await shopifyDevFetch("/x", { headers: { "X-Shopify-Surface": "skills" } });
    expect(headersOf(lastCall().init)["X-Shopify-Surface"]).toBe("skills");
  });

  it("bypasses the resolver for absolute URLs", async () => {
    process.env[STAGING_KEY] = "3";
    process.env[TOKEN_KEY] = "t";

    await shopifyDevFetch("https://example.com/raw");
    const { url, init } = lastCall();
    expect(url).toBe("https://example.com/raw");
    // Cookie must NOT be injected when the caller passed a full URL
    expect(headersOf(init).Cookie).toBeUndefined();
  });

  it("throws when staging is set without a Minerva token", async () => {
    process.env[STAGING_KEY] = "3";

    await expect(shopifyDevFetch("/assistant/search")).rejects.toThrow(
      /no Minerva token is available/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors SHOPIFY_DEV_INSTRUMENTATION_URL on /mcp/usage paths", async () => {
    process.env[INSTR_URL_KEY] = "http://127.0.0.1:0/";

    await shopifyDevFetch("/mcp/usage", { method: "POST", body: "{}" });
    expect(lastCall().url).toBe("http://127.0.0.1:0/mcp/usage");
  });

  it("ignores SHOPIFY_DEV_INSTRUMENTATION_URL for non-/mcp/usage paths", async () => {
    process.env[INSTR_URL_KEY] = "http://127.0.0.1:0/";

    await shopifyDevFetch("/assistant/search", { method: "POST", body: "{}" });
    expect(lastCall().url).toBe("https://shopify.dev/assistant/search");
  });

  it("includes the response body in the error for 4xx responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("bad request: missing query", { status: 400 }),
    );
    await expect(shopifyDevFetch("/assistant/search")).rejects.toThrow(
      "HTTP 400: bad request: missing query",
    );
  });

  it("includes the response body in the error for 5xx responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream timeout from search service", { status: 503 }),
    );
    await expect(shopifyDevFetch("/assistant/search")).rejects.toThrow(
      "HTTP 503: upstream timeout from search service",
    );
  });

  it("falls back to a status-only message when the error body is empty", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(shopifyDevFetch("/assistant/search")).rejects.toThrow(
      "HTTP error! status: 500",
    );
  });
});
