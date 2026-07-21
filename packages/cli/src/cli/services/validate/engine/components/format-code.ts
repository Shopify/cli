// Synthesizes the `import '@shopify/...'` lines that activate the bundled type
// surfaces for the code under validation, and normalizes raw-HTML snippets into
// JSX. Pure string manipulation — no TypeScript dependency. Faithful port of the
// source `validation/formatCode.ts`.

function generateMissingImports(packageNames: string[], extensionTarget?: string): string {
  return packageNames
    .map((packageName) => {
      if (extensionTarget && packageName.includes('@shopify/ui-extensions')) {
        return `import '${packageName}/${extensionTarget}';`
      }
      return `import '${packageName}';`
    })
    .join('\n')
}

function addShopifyImports(code: string, packageNames: string[], extensionTarget?: string): string {
  if (packageNames.includes('@shopify/ui-extensions') && !extensionTarget) {
    throw new Error('Invalid input: extensionTarget is required')
  }

  const generatedImports = generateMissingImports(packageNames, extensionTarget)

  // Don't redeclare `shopify` when the snippet already declares it.
  if (code && (code.includes('const shopify =') || code.includes('globalThis.shopify'))) {
    return generatedImports
  }

  const shopifyGlobalDeclaration =
    packageNames.find((pkg) => pkg.includes('@shopify/ui-extensions')) && extensionTarget
      ? `interface ShopifyApiOverride extends Omit<import('@shopify/ui-extensions/${extensionTarget}').Api, 'query'> { query: (...args: any[]) => Promise<{ data: any; errors?: any[] }>; } const shopify: ShopifyApiOverride = (globalThis as any).shopify;`
      : ''

  return `${generatedImports}\n${shopifyGlobalDeclaration}`.trim()
}

/**
 * Prepends the synthetic Shopify imports (and, for extension APIs, a typed
 * `shopify` global) to the user's code so the virtual TypeScript environment
 * type-checks it against the loaded component surfaces. Raw HTML documents are
 * unwrapped from their `<body>` into a JSX fragment first.
 */
export function formatCode(code: string, packageNames: string[], extensionTarget?: string): string {
  // If the snippet is a full HTML document, extract the body and wrap it in a
  // JSX fragment so it parses as JSX.
  let normalizedCode = code
  if (normalizedCode.includes('!DOCTYPE') || normalizedCode.includes('!html')) {
    const bodyContent = normalizedCode.match(/<body>(.*?)<\/body>/s)?.[1]
    if (bodyContent) {
      normalizedCode = `<>${bodyContent}</>`
    }
  }

  const shopifyImports = addShopifyImports(normalizedCode, packageNames, extensionTarget)

  return `
${shopifyImports}
${normalizedCode}
`
}
