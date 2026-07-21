// Extracts the set of Shopify component/tag names declared in a package's type
// definition content, so the validator can tell Shopify components apart from
// HTML/SVG/user components. Pure regex over declaration text — no TypeScript
// dependency. Faithful port of the source `validation/extractShopifyComponents.ts`.

export function extractShopifyComponents(content: string, packageName: string | undefined): string[] {
  if (!packageName) {
    return []
  }
  switch (packageName) {
    case '@shopify/polaris-types':
    case '@shopify/ui-extensions':
      return extractWebComponentTagNames(content)
    case '@shopify/ui-extensions-react':
      return extractReactBindingComponentNames(content)
    case '@shopify/app-bridge-types':
      return extractAppBridgeElements(content)
    case '@shopify/hydrogen':
      return extractHydrogenComponents(content)
    case '@shopify/app-bridge-react':
      return extractAppBridgeReactComponents(content)
    default:
      return []
  }
}

// Extract React component exports from the @shopify/app-bridge-react type
// definitions. Matches:
//   export declare const TitleBar: React.ComponentType<...>
//   export declare const Modal: React.ForwardRefExoticComponent<...>
function extractAppBridgeReactComponents(content: string): string[] {
  const components: string[] = []
  const re = /(?:export\s+)?declare\s+const\s+(\w+)\s*:\s*React\.(?:ComponentType|ForwardRefExoticComponent)\b/g
  let match
  while ((match = re.exec(content)) !== null) {
    components.push(match[1]!)
  }
  return [...new Set(components)]
}

/**
 * Extract web component tag names from type definition content. Matches:
 * 1. `declare const tagName = 's-button'` / `declare const tagName$X = "s-avatar"`
 * 2. `HTMLElementTagNameMap { ['s-component']: ... }`
 * 3. `IntrinsicElements { ['s-component']: ... }`
 */
function extractWebComponentTagNames(content: string): string[] {
  const components: string[] = []

  const tagNameRegex = /declare\s+const\s+tagName\$?\w*\s*=\s*['"]([^'"]+)['"]/g
  const bracketKeyRegex = /\[['"]([a-z]+-[a-z-]+)['"]\]\s*:/g
  let match
  while ((match = tagNameRegex.exec(content)) !== null || (match = bracketKeyRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }

  return [...new Set(components)]
}

/**
 * Extract web component tag names from an AppBridgeElements interface, e.g.
 * `'ui-modal': UIModalAttributes`.
 */
function extractAppBridgeElements(content: string): string[] {
  const components: string[] = []
  const interfaceMatch = content.match(/interface\s+AppBridgeElements\s*\{([^}]+)\}/)

  if (interfaceMatch) {
    const keyRegex = /['"]([a-z]+-[a-z-]+)['"]\s*:/g
    let match
    while ((match = keyRegex.exec(interfaceMatch[1]!)) !== null) {
      components.push(match[1]!)
    }
  }

  return components
}

// Extract React component names from the @shopify/ui-extensions-react type
// files. Matches leaf `export declare const Name: "Name" & {...}` declarations
// and barrel `export { Name1, Name2 as Alias } from '...'` re-exports (skipping
// type-only re-exports and inline `type` modifiers).
function extractReactBindingComponentNames(content: string): string[] {
  const components = new Set<string>()

  const leafConstRegex = /export\s+declare\s+const\s+([A-Z]\w*)\s*:\s*"\1"\s*&/g
  let match
  while ((match = leafConstRegex.exec(content)) !== null) {
    components.add(match[1]!)
  }

  const barrelExportRegex = /export\s+(?!type\b)\{([^}]+)\}/g
  while ((match = barrelExportRegex.exec(content)) !== null) {
    for (const rawItem of match[1]!.split(',')) {
      const item = rawItem.trim()
      if (!item) continue
      if (/^type\s/.test(item)) continue
      const parts = item.split(/\s+as\s+/)
      const exported = parts[parts.length - 1]!.trim()
      if (/^[A-Z]\w*$/.test(exported)) {
        components.add(exported)
      }
    }
  }

  return [...components]
}

/**
 * Extract Hydrogen components from type definition content: compound components
 * (`declare const Analytics: { CartView: typeof ...; }`) and JSX-returning
 * function/const declarations.
 */
function extractHydrogenComponents(content: string): string[] {
  const components: string[] = []
  let match

  const jsxFunctionRegex =
    /declare\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*(?:react_jsx_runtime\.)?JSX\.Element/g
  while ((match = jsxFunctionRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }

  const fcReturnTypeRegex = /declare\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*ReturnType<FC>/g
  while ((match = fcReturnTypeRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }

  const funcComponentElementRegex =
    /declare\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*react\.FunctionComponentElement/g
  while ((match = funcComponentElementRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }

  const forwardRefRegex = /declare\s+const\s+(\w+)\s*:\s*react\.ForwardRefExoticComponent/g
  while ((match = forwardRefRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }

  const providerRegex = /declare\s+const\s+(\w+)\s*:\s*react\.Provider/g
  while ((match = providerRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }

  return [...new Set(components)]
}
