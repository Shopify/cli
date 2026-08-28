// Unit-test subprocesses must use source files because CI does not build packages before testing.
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@shopify/cli-kit/')) {
    const modulePath = specifier.slice('@shopify/cli-kit/'.length)
    const sourceUrl = new URL(`../../src/public/${modulePath}.js`, import.meta.url)
    return nextResolve(sourceUrl.href, context)
  }

  return nextResolve(specifier, context)
}
