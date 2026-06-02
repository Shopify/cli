import {dirname, relativePath} from '@shopify/cli-kit/node/path'

/**
 * Compute a POSIX-style relative path from a TOML file to its cached JSON Schema.
 * Used to build the `#:schema <path>` directive that Taplo (and other TOML LSPs) resolve.
 *
 * Always returns a path with `/` separators (pathe normalizes per-platform) and a leading
 * `./` for paths that don't already begin with `.`, which is the conventional form for
 * Taplo schema directives.
 */
export function posixRelativeSchemaPath(fromTomlPath: string, toSchemaPath: string): string {
  const rel = relativePath(dirname(fromTomlPath), toSchemaPath)
  return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`
}
