export function extractShopifyComponents(
  content: string,
  packageName: string | undefined,
): string[] {
  if (!packageName) {
    return [];
  }
  switch (packageName) {
    case "@shopify/polaris-types":
    case "@shopify/ui-extensions":
      return extractWebComponentTagNames(content);
    case "@shopify/ui-extensions-react":
      return extractReactBindingComponentNames(content);
    case "@shopify/app-bridge-types":
      return extractAppBridgeElements(content);
    case "@shopify/hydrogen":
      return extractHydrogenComponents(content);
    case "@shopify/app-bridge-react":
      return extractAppBridgeReactComponents(content);
    default:
      return [];
  }
}

/**
 * Extract React component exports from @shopify/app-bridge-react type
 * definitions. Matches the two shapes the package ships today:
 *
 *   export declare const TitleBar: React.ComponentType<...>;
 *   export declare const Modal: React.ForwardRefExoticComponent<...>;
 *
 * (Distinct from the Hydrogen extractor — those use lowercase `react.` and
 * no `export` prefix.) Without this, @shopify/app-bridge-react falls into
 * the default branch, types load fine but the React wrappers are silently
 * classified as unvalidated/non-Shopify components and never appear in
 * `validatedComponents`.
 */
function extractAppBridgeReactComponents(content: string): string[] {
  const components: string[] = [];
  const re =
    /(?:export\s+)?declare\s+const\s+(\w+)\s*:\s*React\.(?:ComponentType|ForwardRefExoticComponent)\b/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    components.push(match[1]);
  }
  return [...new Set(components)];
}
/**
 * Extract web component tag names from type definition content.
 * Matches multiple patterns:
 * 1. declare const tagName = 's-button' or declare const tagName$X = "s-avatar" (polaris-types, POS ui-extensions)
 * 2. HTMLElementTagNameMap { ['s-component']: ... } (customer-account ui-extensions)
 * 3. IntrinsicElements { ['s-component']: ... } (customer-account ui-extensions)
 * Works for @shopify/polaris-types, @shopify/app-bridge-types, and @shopify/ui-extensions
 */
function extractWebComponentTagNames(content: string): string[] {
  const components: string[] = [];

  // Pattern 1: declare const tagName = 's-...' or declare const tagName$X = "s-..."
  const tagNameRegex =
    /declare\s+const\s+tagName\$?\w*\s*=\s*['"]([^'"]+)['"]/g;
  // Pattern 2: HTMLElementTagNameMap { ['s-...'] } or IntrinsicElements { ['s-...'] }
  // Matches: ['s-customer-account-action']: or ["s-button"]:
  const bracketKeyRegex = /\[['"]([a-z]+-[a-z-]+)['"]\]\s*:/g;
  let match;
  while (
    (match = tagNameRegex.exec(content)) !== null ||
    (match = bracketKeyRegex.exec(content)) !== null
  ) {
    components.push(match[1]);
  }

  // Deduplicate (same component might appear in both HTMLElementTagNameMap and IntrinsicElements)
  return [...new Set(components)];
}

/**
 * Extract web component tag names from AppBridgeElements interface.
 * Matches patterns like: 'ui-modal': UIModalAttributes
 */
function extractAppBridgeElements(content: string): string[] {
  const components: string[] = [];
  // Match interface AppBridgeElements { ... } and extract quoted keys
  const interfaceMatch = content.match(
    /interface\s+AppBridgeElements\s*\{([^}]+)\}/,
  );

  if (interfaceMatch) {
    const keyRegex = /['"]([a-z]+-[a-z-]+)['"]\s*:/g;
    let match;
    while ((match = keyRegex.exec(interfaceMatch[1])) !== null) {
      components.push(match[1]);
    }
  }

  return components;
}

/**
 * Extract React component names from @shopify/ui-extensions-react type files.
 *
 * Each surface ships two flavours of .d.ts files:
 *   1. Leaf component files (one component per file), shaped like:
 *      `export declare const AdminAction: "AdminAction" & { ... }`
 *   2. Barrel files (e.g. `admin/components.d.ts`) re-exporting many
 *      components: `export { AdminAction } from './components/AdminAction/AdminAction';`
 *      Type-only re-exports (`export type { AdminActionProps }`) are skipped
 *      because they are not callable as JSX.
 *
 * Hooks (`useApi`) and helpers (`reactExtension`, `render`) are filtered out
 * by the PascalCase check — they are not used as JSX tags.
 */
function extractReactBindingComponentNames(content: string): string[] {
  const components = new Set<string>();

  // Pattern 1: leaf `export declare const Name: "Name" & { ... }` declarations.
  // The `"Name" &` tail (backreferenced via \1) pins the match to the real
  // component shape so unrelated PascalCase exports like
  // `export declare const HttpStatus: Readonly<...>` are not picked up.
  const leafConstRegex =
    /export\s+declare\s+const\s+([A-Z]\w*)\s*:\s*"\1"\s*&/g;
  let match;
  while ((match = leafConstRegex.exec(content)) !== null) {
    components.add(match[1]);
  }

  // Pattern 2: barrel `export { Name1, Name2 as Alias } from '...'`
  // Excludes `export type { ... }` re-exports (types are not JSX-callable).
  const barrelExportRegex = /export\s+(?!type\b)\{([^}]+)\}/g;
  while ((match = barrelExportRegex.exec(content)) !== null) {
    for (const rawItem of match[1].split(",")) {
      const item = rawItem.trim();
      if (!item) continue;
      // Skip inline type modifiers (`export { type Foo as Bar }`, TS 4.5+).
      // Without this, `type Foo as Bar` would split to ["type Foo", "Bar"]
      // and leak `Bar` as a phantom JSX component.
      if (/^type\s/.test(item)) continue;
      // Handle `Name as Alias` — the alias is the name visible to JSX.
      const parts = item.split(/\s+as\s+/);
      const exported = parts[parts.length - 1].trim();
      if (/^[A-Z]\w*$/.test(exported)) {
        components.add(exported);
      }
    }
  }

  return [...components];
}

/**
 * Extract Hydrogen components from type definition content.
 * Matches:
 * 1. Analytics compound component pattern:
 *    declare const Analytics: { CartView: typeof AnalyticsCartView; ... };
 *    Returns: ["Analytics.CartView", "Analytics.CollectionView", ...]
 * 2. Function components returning JSX.Element:
 *    declare function CartForm(...): JSX.Element;
 *    Returns: ["CartForm", ...]
 */
function extractHydrogenComponents(content: string): string[] {
  const components: string[] = [];
  let match;

  // Pattern 1: declare function ComponentName(...): JSX.Element or react_jsx_runtime.JSX.Element
  const jsxFunctionRegex =
    /declare\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*(?:react_jsx_runtime\.)?JSX\.Element/g;
  while ((match = jsxFunctionRegex.exec(content)) !== null) {
    components.push(match[1]);
  }

  // Pattern 2: declare function ComponentName(...): ReturnType<FC>
  const fcReturnTypeRegex =
    /declare\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*ReturnType<FC>/g;
  while ((match = fcReturnTypeRegex.exec(content)) !== null) {
    components.push(match[1]);
  }

  // Pattern 3: declare function ComponentName(...): react.FunctionComponentElement<...>
  const funcComponentElementRegex =
    /declare\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*react\.FunctionComponentElement/g;
  while ((match = funcComponentElementRegex.exec(content)) !== null) {
    components.push(match[1]);
  }

  // Pattern 4: declare const ComponentName: react.ForwardRefExoticComponent<...>
  const forwardRefRegex =
    /declare\s+const\s+(\w+)\s*:\s*react\.ForwardRefExoticComponent/g;
  while ((match = forwardRefRegex.exec(content)) !== null) {
    components.push(match[1]);
  }

  // Pattern 5: declare const ComponentName: react.Provider<...>
  const providerRegex = /declare\s+const\s+(\w+)\s*:\s*react\.Provider/g;
  while ((match = providerRegex.exec(content)) !== null) {
    components.push(match[1]);
  }

  // Remove duplicates and return
  return [...new Set(components)];
}
