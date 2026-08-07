import type ts from 'typescript'

// `typescript` is a large dependency (~several MB). It is declared as a real
// dependency of `@shopify/cli` and marked esbuild-external so it is NOT inlined
// into the CLI bundle, and it is loaded lazily here — only when the components
// validator actually runs. This mirrors the existing precedent in
// `packages/app/src/cli/models/extensions/specifications/type-generation.ts`,
// which does the same dynamic import. Every other `shopify validate` subcommand
// (functions, graphql, theme) stays free of the TypeScript compiler entirely.

/**
 * Dynamically imports the TypeScript compiler. `typescript` is published as
 * CommonJS, so the dynamic import wraps the module as `{default: ...}`; we
 * unwrap it to return the compiler namespace directly.
 */
export async function loadTypeScript(): Promise<typeof ts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('typescript')
  return mod.default ?? mod
}
