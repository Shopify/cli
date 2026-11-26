const cliKitLoader = await import(
  new URL('../../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href
)

// Unit-test CI has no generated workspace modules for these imports.
const workspaceSources = new Map([
  ['@shopify/organizations', '../../../organizations/src/index.js'],
  ['@shopify/theme', '../../../theme/src/index.js'],
])

export function resolve(specifier, context, nextResolve) {
  const source = workspaceSources.get(specifier)
  if (source) return nextResolve(new URL(source, import.meta.url).href, context)
  return cliKitLoader.resolve(specifier, context, nextResolve)
}
