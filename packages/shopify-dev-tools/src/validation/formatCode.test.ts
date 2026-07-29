import { describe, expect, it } from "vitest";
import { formatCode } from "./formatCode";

describe("formatCode", () => {
  it("generates basic import for non-ui-extensions package", () => {
    const code = `const x = 1;`;
    const result = formatCode(code, ["@shopify/polaris"]);

    expect(result).toBe(`
import '@shopify/polaris';
const x = 1;
`);
  });

  it("generates import with extension target for ui-extensions package", () => {
    const code = `const x = 1;`;
    const result = formatCode(
      code,
      ["@shopify/ui-extensions"],
      "pos.home.tile.render",
    );

    expect(result).toBe(`
import '@shopify/ui-extensions/pos.home.tile.render';
interface ShopifyApiOverride extends Omit<import('@shopify/ui-extensions/pos.home.tile.render').Api, 'query'> { query: (...args: any[]) => Promise<{ data: any; errors?: any[] }>; } const shopify: ShopifyApiOverride = (globalThis as any).shopify;
const x = 1;
`);
  });

  it("generates multiple imports for multiple packages", () => {
    const code = `const x = 1;`;
    const result = formatCode(
      code,
      ["@shopify/polaris", "@shopify/ui-extensions"],
      "pos.home.tile.render",
    );

    expect(result).toBe(`
import '@shopify/polaris';
import '@shopify/ui-extensions/pos.home.tile.render';
interface ShopifyApiOverride extends Omit<import('@shopify/ui-extensions/pos.home.tile.render').Api, 'query'> { query: (...args: any[]) => Promise<{ data: any; errors?: any[] }>; } const shopify: ShopifyApiOverride = (globalThis as any).shopify;
const x = 1;
`);
  });

  it("skips shopify global declaration when code contains 'const shopify ='", () => {
    const code = `const shopify = something;`;
    const result = formatCode(code, ["@shopify/ui-extensions"], "checkout");

    expect(result).toBe(`
import '@shopify/ui-extensions/checkout';
const shopify = something;
`);
  });

  it("skips shopify global declaration when code contains 'globalThis.shopify'", () => {
    const code = `const api = globalThis.shopify;`;
    const result = formatCode(code, ["@shopify/ui-extensions"], "checkout");

    expect(result).toBe(`
import '@shopify/ui-extensions/checkout';
const api = globalThis.shopify;
`);
  });

  it("does not add shopify global declaration for non-ui-extensions packages", () => {
    const code = `const x = 1;`;
    const result = formatCode(code, ["@shopify/polaris"], "checkout");

    expect(result).toBe(`
import '@shopify/polaris';
const x = 1;
`);
  });

  it("handles empty package names array", () => {
    const code = `const x = 1;`;
    const result = formatCode(code, []);

    expect(result).toBe(`

const x = 1;
`);
  });

  it("throws error when @shopify/ui-extensions is provided but extensionTarget is not", () => {
    const code = `const x = 1;`;
    expect(() => formatCode(code, ["@shopify/ui-extensions"])).toThrow(
      "Invalid input: extensionTarget is required",
    );
  });

  it("extracts body content from HTML with DOCTYPE", () => {
    const code = `<!DOCTYPE html><html><body><div>Hello</div></body></html>`;
    const result = formatCode(code, ["@shopify/polaris"]);

    expect(result).toBe(`
import '@shopify/polaris';
<><div>Hello</div></>
`);
  });

  it("extracts body content from HTML with !html tag", () => {
    const code = `<!html><body><span>World</span></body></html>`;
    const result = formatCode(code, ["@shopify/polaris"]);

    expect(result).toBe(`
import '@shopify/polaris';
<><span>World</span></>
`);
  });

  it("handles HTML without body tags gracefully", () => {
    const code = `<!DOCTYPE html><html><head></head></html>`;
    const result = formatCode(code, ["@shopify/polaris"]);

    expect(result).toBe(`
import '@shopify/polaris';
<!DOCTYPE html><html><head></head></html>
`);
  });
});
