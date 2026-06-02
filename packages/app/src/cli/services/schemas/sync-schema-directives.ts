import {CachedSchemaIndex} from './write-cached-schemas.js'
import {posixRelativeSchemaPath} from './relative-path.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {configurationFileNames} from '../../constants.js'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, isAbsolutePath, joinPath, normalizePath, resolvePath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'

// Matches Taplo's `#:schema <url>` directive on the first line, tolerating optional whitespace
// around the `#` and `:` (e.g. `# :schema ...`). The captured path is in group 3.
const SCHEMA_DIRECTIVE_REGEX = /^([ \t]*)#[ \t]*:[ \t]*schema[ \t]+(.+?)[ \t]*(\r?\n|$)/

/**
 * Add or update the `#:schema <path>` directive in each TOML file managed by the app so IDE TOML
 * extensions (Taplo / Even Better TOML) can locate the right cached schema.
 *
 * - Missing directive → prepend one.
 * - Directive points inside `.shopify/schemas/` but at the wrong file → rewrite.
 * - Directive already matches → no write (idempotent).
 * - Directive points at a user-custom location (URL, path outside our cache) → leave alone.
 *
 * File-level errors are logged via `outputDebug` and swallowed. Schema cache sync must never
 * be the reason `validate` fails.
 */
export async function syncSchemaDirectives(app: AppLinkedInterface, index: CachedSchemaIndex): Promise<void> {
  const cacheRoot = normalizePath(joinPath(app.directory, configurationFileNames.hiddenFolder, 'schemas'))

  const appConfigPath = normalizePath(app.configPath)
  await syncOne(app.configPath, index.appSchemaPath, cacheRoot)

  // Some "extensions" (e.g. webhook_subscription entries from `[[webhooks.subscriptions]]`)
  // are declared inline in shopify.app.toml and report their configurationPath as the app TOML.
  // The app schema already covers those inline blocks — rewriting the directive to point at the
  // per-spec schema would clobber the correct app-level directive. Skip them.
  const seenTomls = new Set<string>([appConfigPath])
  for (const extension of app.allExtensions) {
    const tomlPath = normalizePath(extension.configurationPath)
    if (seenTomls.has(tomlPath)) continue
    seenTomls.add(tomlPath)
    const schemaPath = index.extensionSchemaByIdentifier.get(extension.specification.identifier)
    if (!schemaPath) continue
    // eslint-disable-next-line no-await-in-loop
    await syncOne(extension.configurationPath, schemaPath, cacheRoot)
  }
}

async function syncOne(tomlPath: string, schemaPath: string, cacheRoot: string): Promise<void> {
  try {
    const original = await readFile(tomlPath)
    const updated = rewriteSchemaDirective(original, tomlPath, schemaPath, cacheRoot)
    if (updated !== null && updated !== original) {
      await writeFile(tomlPath, updated)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    // Best-effort: cache directives are an IDE convenience. Any failure here (missing file,
    // permission denied, ...) is logged and swallowed so validation still reports its result.
    outputDebug(`Failed to sync schema directive for ${tomlPath}: ${err}`)
  }
}

/**
 * Pure transform used by `syncSchemaDirectives` and exercised directly in tests.
 *
 * Return values:
 * - A modified string → caller should write it back.
 * - The original string unchanged → directive already matches; no write needed.
 * - `null` → the file points to a user-custom schema location; leave the file alone.
 */
export function rewriteSchemaDirective(
  raw: string,
  tomlPath: string,
  schemaPath: string,
  cacheRoot: string,
): string | null {
  const desiredPath = posixRelativeSchemaPath(tomlPath, schemaPath)
  const match = SCHEMA_DIRECTIVE_REGEX.exec(raw)

  if (!match) {
    return `#:schema ${desiredPath}\n\n${raw}`
  }

  const existing = match[2]!
  if (existing === desiredPath) return raw

  const existingResolved = resolveDirectiveTarget(tomlPath, existing)
  const isInsideCache = existingResolved !== null && existingResolved.startsWith(`${cacheRoot}/`)
  if (!isInsideCache) return null

  const indent = match[1] ?? ''
  const trail = match[3] ?? '\n'
  return raw.replace(SCHEMA_DIRECTIVE_REGEX, `${indent}#:schema ${desiredPath}${trail || '\n'}`)
}

/**
 * Resolve a `#:schema` directive's target to an absolute filesystem path.
 * Returns `null` when the target is a non-file URL (http, https, etc.) — those are
 * always treated as user-managed and left alone.
 */
function resolveDirectiveTarget(tomlPath: string, directive: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(directive) && !directive.startsWith('file://')) return null
  const stripped = directive.startsWith('file://') ? directive.slice('file://'.length) : directive
  if (isAbsolutePath(stripped)) return normalizePath(stripped)
  return normalizePath(resolvePath(dirname(tomlPath), stripped))
}
