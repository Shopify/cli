function generateMissingImports(
  packageNames: string[],
  extensionTarget?: string,
): string {
  return packageNames
    .map((packageName) => {
      if (extensionTarget && packageName.includes("@shopify/ui-extensions")) {
        return `import '${packageName}/${extensionTarget}';`;
      }
      return `import '${packageName}';`;
    })
    .join("\n");
}

function addShopifyImports(
  code: string,
  packageNames: string[],
  extensionTarget?: string,
): string {
  if (packageNames.includes("@shopify/ui-extensions") && !extensionTarget) {
    throw new Error("Invalid input: extensionTarget is required");
  }

  const generatedImports = generateMissingImports(
    packageNames,
    extensionTarget,
  );

  //Check if code contains const shopify or globalThis.shopify so we dont redeclare it
  if (
    code &&
    (code.includes("const shopify =") || code.includes("globalThis.shopify"))
  ) {
    return generatedImports;
  }

  const shopifyGlobalDeclaration =
    packageNames.find((pkg) => pkg.includes("@shopify/ui-extensions")) &&
    extensionTarget
      ? `interface ShopifyApiOverride extends Omit<import('@shopify/ui-extensions/${extensionTarget}').Api, 'query'> { query: (...args: any[]) => Promise<{ data: any; errors?: any[] }>; } const shopify: ShopifyApiOverride = (globalThis as any).shopify;`
      : "";

  const shopifyImports =
    `${generatedImports}\n${shopifyGlobalDeclaration}`.trim();

  return shopifyImports;
}

export function formatCode(
  code: string,
  packageNames: string[],
  extensionTarget?: string,
): string {
  //if code contains !DOCTYPE or !html, extract everything inside body tags and wrap it with <> tag
  if (code.includes("!DOCTYPE") || code.includes("!html")) {
    const bodyContent = code.match(/<body>(.*?)<\/body>/s)?.[1];
    if (bodyContent) {
      code = `<>${bodyContent}</>`;
    }
  }
  const shopifyImports = addShopifyImports(code, packageNames, extensionTarget);

  const codeWithImports = `
${shopifyImports}
${code}
`;
  return codeWithImports;
}
