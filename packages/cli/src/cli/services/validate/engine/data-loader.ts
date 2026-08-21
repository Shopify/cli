import {fileExistsSync, readFileSync, globSync} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, moduleDirectory} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {gunzipSync} from 'node:zlib'
import type {SchemaSource, ResolvedApiSchema} from './schema-source.js'
import type {VersionCatalog} from './contract.js'

// The SINGLE offline reference-data loader shared by every data-backed
// `shopify validate` subcommand (graphql, functions, components). It is
// deliberately dependency-lean — only `@shopify/cli-kit/node/{fs,path,error}`
// and `node:zlib`, never `graphql` or `typescript` — so importing it from the
// shared foundation never drags in a validator's heavy runtime.
//
// Two locked constraints shape this module:
//   1. Fully offline & deterministic — no network, no login. All schema bytes,
//      type declarations and the version catalog are read from files shipped
//      inside the CLI package.
//   2. It must resolve asset paths in BOTH runtime modes:
//        (a) dev/tests running from TS source (tsx/vitest) → packages/cli/assets
//        (b) the bundled esbuild `dist`                    → dist/assets
//
// esbuild inlines service/engine modules into command chunks and rewrites
// `import.meta.url` to the emitted chunk's location, so the depth from this
// module to the assets dir is not fixed. Rather than hard-code a relative hop we
// walk up from `import.meta.url` (see {@link resolveValidateDataDir}) and return
// the first ancestor that actually contains the subcommand's data directory.

// The version catalog file name. It lives at the root of each subcommand's data
// dir (a copy is shipped per subdir) and is the marker graphql/functions probe
// for when locating their data directory.
const VERSION_CATALOG_FILENAME = 'supported-versions-schema.json'

/**
 * Pure walk used by {@link resolveValidateDataDir}. Starting at `startDir` and
 * walking up to the filesystem root, returns the first
 * `<ancestor>/assets/validate/<dataSubdir>` (preferred) or
 * `<ancestor>/dist/assets/validate/<dataSubdir>` whose `markerRelPath` exists
 * according to `exists`. Pure — `startDir` and `exists` are injected so it can
 * be unit-tested without depending on the real on-disk layout or
 * `import.meta.url`.
 *
 * `dataSubdir` is the subcommand's leaf directory name (`graphql`, `functions`,
 * or `components`).
 */
export function findDataDir(
  startDir: string,
  dataSubdir: string,
  markerRelPath: ReadonlyArray<string>,
  exists: (path: string) => boolean,
): string | undefined {
  const candidates: string[][] = [
    ['assets', 'validate', dataSubdir],
    ['dist', 'assets', 'validate', dataSubdir],
  ]
  let dir = startDir
  for (;;) {
    for (const parts of candidates) {
      const candidate = joinPath(dir, ...parts)
      if (exists(joinPath(candidate, ...markerRelPath))) {
        return candidate
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

// Production resolution is cached per (dataSubdir, marker): the bundled data is
// immutable for the process lifetime, and the walk touches the filesystem.
// Tests inject their own data dir and bypass this entirely.
const cachedDataDirs = new Map<string, string>()

/**
 * Resolves the absolute path to a subcommand's bundled reference-data
 * directory, working in both dev/test (running from TS source) and the bundled
 * dist. Throws a clear {@link AbortError} if the assets cannot be located.
 */
export function resolveValidateDataDir(dataSubdir: string, markerRelPath: ReadonlyArray<string>): string {
  const cacheKey = `${dataSubdir}::${markerRelPath.join('/')}`
  const cached = cachedDataDirs.get(cacheKey)
  if (cached !== undefined) return cached

  const found = findDataDir(moduleDirectory(import.meta.url), dataSubdir, markerRelPath, fileExistsSync)
  if (!found) {
    throw new AbortError(
      `Could not locate the bundled '${dataSubdir}' validation data.`,
      'This is an internal packaging error — please report it.',
    )
  }
  cachedDataDirs.set(cacheKey, found)
  return found
}

/** Reads and parses the version catalog (`supported-versions-schema.json`). */
export function readVersionCatalog(dataDir: string): VersionCatalog {
  const catalogPath = joinPath(dataDir, VERSION_CATALOG_FILENAME)
  return JSON.parse(readFileSync(catalogPath).toString('utf8')) as VersionCatalog
}

// ---------------------------------------------------------------------------
// GraphQL / Functions: gzipped introspection schema loading
// ---------------------------------------------------------------------------

// In-memory cache keyed by absolute schema path. Decompressing a multi-hundred-KB
// schema is not free, and a single command may validate against the same schema
// more than once, so we memoize the decompressed JSON.
const schemaContentCache = new Map<string, string>()

/**
 * Reads and decompresses the introspection JSON for a schema path. Accepts a
 * `.json.gz` path directly, a plain `.json` path, or a `.json` path whose bytes
 * actually live at `<path>.gz` (the layout the catalog implies). Results are
 * cached by path.
 */
export function loadSchemaContentFromPath(schemaPath: string): string {
  const cached = schemaContentCache.get(schemaPath)
  if (cached !== undefined) return cached

  let content: string
  if (schemaPath.endsWith('.gz')) {
    content = gunzipSync(readFileSync(schemaPath)).toString('utf8')
  } else if (fileExistsSync(schemaPath)) {
    content = readFileSync(schemaPath).toString('utf8')
  } else {
    const gzPath = `${schemaPath}.gz`
    if (!fileExistsSync(gzPath)) {
      throw new AbortError(`Schema file not found at ${schemaPath} or ${gzPath}`)
    }
    content = gunzipSync(readFileSync(gzPath)).toString('utf8')
  }

  schemaContentCache.set(schemaPath, content)
  return content
}

/**
 * The path a schema file is expected at, given the data directory, API name and
 * version — e.g. `<dataDir>/admin_2026-04.json`. The `.gz` variant is resolved
 * transparently by {@link loadSchemaContentFromPath}.
 */
export function schemaPathFor(dataDir: string, api: string, versionName: string): string {
  return joinPath(dataDir, `${api}_${versionName}.json`)
}

/**
 * The default {@link SchemaSource}: reads the version catalog and schema bytes
 * from `dataDir`. `dataDir` is injectable so tests can point at a fixture
 * directory; production callers pass the result of {@link resolveValidateDataDir}.
 */
export function createDiskSchemaSource(dataDir: string): SchemaSource {
  return {
    readVersionCatalog(): VersionCatalog {
      return readVersionCatalog(dataDir)
    },
    readSchemaContent(schema: ResolvedApiSchema): Promise<string> {
      return Promise.resolve(loadSchemaContentFromPath(schema.schemaPath))
    },
  }
}

// ---------------------------------------------------------------------------
// Components: gzip-aware type-declaration loading
// ---------------------------------------------------------------------------

/** One `(package, version)` reference in the components `types/index.json`. */
export interface PackageRef {
  package: string
  version: string
}

/** The parsed shape of the components `types/index.json`. */
export interface TypesIndex {
  _always_loaded?: PackageRef[]
  [apiOrSpecial: string]: PackageRef[] | Record<string, PackageRef[]> | undefined
}

/** The `types/` subdirectory of a components data directory. */
export function typesDirFor(dataDir: string): string {
  return joinPath(dataDir, 'types')
}

/** Reads and parses the components `<dataDir>/types/index.json`. */
export function readTypesIndex(dataDir: string): TypesIndex {
  const indexPath = joinPath(typesDirFor(dataDir), 'index.json')
  return JSON.parse(readFileSync(indexPath).toString('utf8')) as TypesIndex
}

// Path-keyed cache of decoded asset contents. The bundled reference data is
// immutable for the lifetime of the process, and a single validation call reads
// (and gunzips) the same declaration files repeatedly, so caching the decoded
// text avoids re-gunzipping multi-MB `.d.ts.gz` files on every call. Keyed by
// the resolved absolute path; misses are cached too so a not-found probe isn't
// repeated.
const assetContentCache = new Map<string, string | undefined>()

/**
 * Reads an asset file at `<dataDir>/<relPath>`, transparently handling either a
 * logical (`.d.ts`) or an actual (`.d.ts.gz`) path — the source tree ships raw
 * files while the bundled assets ship gzipped ones. Returns undefined when
 * neither variant exists. Results are memoized per resolved absolute path.
 */
export function readAssetFile(dataDir: string, relPath: string): string | undefined {
  const absPath = joinPath(dataDir, relPath)
  if (assetContentCache.has(absPath)) {
    return assetContentCache.get(absPath)
  }
  const content = readAssetFileFromDisk(absPath)
  assetContentCache.set(absPath, content)
  return content
}

function readAssetFileFromDisk(absPath: string): string | undefined {
  if (absPath.endsWith('.gz')) {
    if (fileExistsSync(absPath)) {
      return gunzipSync(readFileSync(absPath)).toString('utf8')
    }
    const raw = absPath.slice(0, -3)
    return fileExistsSync(raw) ? readFileSync(raw).toString('utf8') : undefined
  }
  if (fileExistsSync(absPath)) {
    return readFileSync(absPath).toString('utf8')
  }
  const gz = `${absPath}.gz`
  return fileExistsSync(gz) ? gunzipSync(readFileSync(gz)).toString('utf8') : undefined
}

export interface AssetTypeFile {
  /** Absolute path on disk (may end in `.gz`). */
  assetPath: string
  /** Logical path relative to `assetRoot`, with any trailing `.gz` stripped. */
  relPath: string
}

/**
 * Enumerates type-source files (`.d.ts` and non-test `.ts`) under `assetRoot`,
 * returning logical paths (trailing `.gz` stripped). Optionally filtered by a
 * predicate over the logical relative path. Uses `globSync` (fast-glob) so path
 * separators are normalized to `/` on every platform, matching the forward-slash
 * paths TypeScript expects internally.
 */
export function listAssetTypeFiles(assetRoot: string, predicate?: (relPath: string) => boolean): AssetTypeFile[] {
  if (!fileExistsSync(assetRoot)) return []
  const matches = globSync(['**/*.d.ts', '**/*.d.ts.gz', '**/*.ts', '**/*.ts.gz'], {
    cwd: assetRoot,
    onlyFiles: true,
    dot: false,
    ignore: ['**/node_modules/**'],
  })

  const seen = new Set<string>()
  const out: AssetTypeFile[] = []
  for (const match of matches) {
    const relPath = match.endsWith('.gz') ? match.slice(0, -3) : match
    const isDeclarationFile = relPath.endsWith('.d.ts')
    const isNonTestSource = relPath.endsWith('.ts') && !relPath.endsWith('.test.ts') && !relPath.endsWith('.spec.ts')
    if (!isDeclarationFile && !isNonTestSource) continue
    if (predicate && !predicate(relPath)) continue
    if (seen.has(relPath)) continue
    seen.add(relPath)
    out.push({assetPath: joinPath(assetRoot, match), relPath})
  }
  return out
}

/** Lists the immediate subdirectory names under `dir` (empty when absent). */
export function listSubdirectories(dir: string): string[] {
  if (!fileExistsSync(dir)) return []
  return globSync('*', {cwd: dir, onlyDirectories: true, dot: false})
}

/** Lists the immediate file names under `dir` (empty when absent). */
export function listFileNames(dir: string): string[] {
  if (!fileExistsSync(dir)) return []
  return globSync('*', {cwd: dir, onlyFiles: true, dot: false})
}
