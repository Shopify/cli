import {addFileToVirtualEnv} from './virtual-ts-environment.js'
import {extractShopifyComponents} from './extract-shopify-components.js'
import {
  type ComponentApi,
  type ComponentApiConfig,
  getPublicPackageName,
  publicPackageAppliesToVersion,
} from './component-apis.js'
import {
  readAssetFile,
  listAssetTypeFiles,
  listSubdirectories,
  listFileNames,
  readTypesIndex,
  typesDirFor,
  type PackageRef,
} from '../data-loader.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {VersionCatalog} from '../contract.js'
import type {VirtualTSEnvironment} from './virtual-ts-environment.js'

// Loads the bundled type definitions needed to validate a snippet for a given
// API + version into the virtual TypeScript environment. Faithful port of the
// source `validation/loadTypesIntoTSEnv.ts`, rebased onto the shared CLI
// data-loader helpers (gunzip-aware asset reads, glob-based enumeration) and
// taking the components `dataDir` + version catalog as explicit inputs rather
// than statically importing JSON / resolving `import.meta.url` internally.

interface UnsupportedVersionInfo {
  requested: string
  supported: string[]
}

interface InvalidTargetInfo {
  target: string
  surface: string
  supported: string[]
}

export interface LoadTypesResult {
  missingPackages: string[]
  searchedPaths: string[]
  shopifyWebComponents: Set<string>
  unsupportedVersion?: UnsupportedVersionInfo
  invalidTarget?: InvalidTargetInfo
  /**
   * Names of `publicPackages` entries that apply to the resolved version.
   * Callers that synthesize imports (`formatCode`) MUST use this list rather
   * than `apiConfig.publicPackages` directly.
   */
  applicablePackageNames: string[]
  /**
   * True iff the bundled `@shopify/ui-extensions` asset tree for the requested
   * (version, surface) ships a per-target `.d.ts` for `extensionTarget`.
   */
  hasTargetSubpath: boolean
}

export interface LoadTypesInput {
  api: ComponentApi
  apiConfig: ComponentApiConfig
  apiVersion: string | undefined
  virtualEnv: VirtualTSEnvironment
  extensionTarget?: string
  /** The components data directory (contains `supported-versions-schema.json` and `types/`). */
  dataDir: string
  /** The version catalog, used for the defense-in-depth version check. */
  catalog: VersionCatalog
}

/**
 * Returns the JSX runtime that matches the code under validation: `react` when
 * the code imports from `@shopify/ui-extensions-react/*` (React-era extensions),
 * and `preact` otherwise (modern web-component era). Hydrogen is always `react`.
 */
export function resolveJsxRuntime(api: ComponentApi, code: string): 'react' | 'preact' {
  if (api === 'hydrogen') return 'react'
  return /^\s*(?:import|export)\b[^'"]*['"]@shopify\/ui-extensions-react(?:\/[^'"]*)?['"]/m.test(code)
    ? 'react'
    : 'preact'
}

function virtualPathFor(packageRoot: string, packageName: string, relPath: string): string {
  return joinPath(packageRoot, 'node_modules', packageName, relPath)
}

function addAssetToVirtualEnv(
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
  packageName: string,
  relPath: string,
  content: string,
  shopifyWebComponents?: Set<string>,
): void {
  const virtPath = virtualPathFor(packageRoot, packageName, relPath)
  addFileToVirtualEnv(virtualEnv, virtPath, content)
  if (shopifyWebComponents) {
    for (const tag of extractShopifyComponents(content, packageName)) {
      shopifyWebComponents.add(tag)
    }
  }
}

/**
 * The asset tree only ships the top-level `package.json` per `(pkg, version)`.
 * Split-entry-point packages (e.g. preact) also publish nested package.json
 * files that legacy NodeJs resolution needs for subpath imports like
 * `import "preact/jsx-runtime"`. For every immediate subdirectory with a logical
 * `src/index.d.ts` (or `index.d.ts`) but no logical `package.json`, synthesize a
 * minimal one.
 */
function synthesizeNestedPackageJsons(
  assetRoot: string,
  packageName: string,
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
): void {
  for (const name of listSubdirectories(assetRoot)) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const subAbs = joinPath(assetRoot, name)
    const hasPkgJson = readAssetFile(subAbs, 'package.json') !== undefined
    if (hasPkgJson) continue

    let typesEntry: string | undefined
    if (readAssetFile(subAbs, joinPath('src', 'index.d.ts')) !== undefined) {
      typesEntry = './src/index.d.ts'
    } else if (readAssetFile(subAbs, 'index.d.ts') !== undefined) {
      typesEntry = './index.d.ts'
    }
    if (!typesEntry) continue

    const synthesized = JSON.stringify({name: `${packageName}/${name}`, types: typesEntry})
    addAssetToVirtualEnv(virtualEnv, packageRoot, packageName, `${name}/package.json`, synthesized)
  }
}

/**
 * Surfaces that re-export symbols from another surface in the same package and
 * therefore need that surface's declaration tree co-loaded with their own.
 * Keyed by surface name (not package/version); co-loading when unneeded only
 * inflates the virtual env slightly.
 */
const CO_REQUIRED_SURFACES: Readonly<Record<string, ReadonlyArray<string>>> = {
  'customer-account': ['checkout'],
}

/**
 * Predicate matching files that belong to a single UI extension surface inside a
 * `build/ts/surfaces/` tree, plus any co-required sibling surfaces and top-level
 * entry-point files (`build/ts/*.d.ts`).
 */
function surfaceMatcher(extensionSurfaceName: string): (relPath: string) => boolean {
  const surfaceNames = [extensionSurfaceName, ...(CO_REQUIRED_SURFACES[extensionSurfaceName] ?? [])]
  const surfaceEntries = new Set(surfaceNames.map((surface) => `build/ts/surfaces/${surface}.d.ts`))
  const surfaceSubtreePrefixes = surfaceNames.map((surface) => `build/ts/surfaces/${surface}/`)
  const topLevelPrefix = 'build/ts/'
  return (rel) => {
    if (surfaceEntries.has(rel)) return true
    if (surfaceSubtreePrefixes.some((prefix) => rel.startsWith(prefix))) return true
    if (rel.startsWith(topLevelPrefix) && rel.endsWith('.d.ts')) {
      const rest = rel.slice(topLevelPrefix.length)
      if (!rest.includes('/')) return true
    }
    return false
  }
}

/**
 * Load every type file under `assetRoot` (optionally filtered) into the virtual
 * environment under `<packageRoot>/node_modules/<packageName>/`.
 */
function loadDtsTree(
  assetRoot: string,
  packageName: string,
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
  shopifyWebComponents: Set<string>,
  predicate?: (relPath: string) => boolean,
): void {
  for (const {relPath} of listAssetTypeFiles(assetRoot, predicate)) {
    const content = readAssetFile(assetRoot, relPath)
    if (!content) continue
    addAssetToVirtualEnv(virtualEnv, packageRoot, packageName, relPath, content, shopifyWebComponents)
  }
}

/** Extract component names from a target entry point's imports. */
function extractComponentImports(content: string): string[] {
  const components: string[] = []
  const importRegex = /import\s+['"]\.\.\/components\/(\w+)\.d\.ts['"]/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    components.push(match[1]!)
  }
  return components
}

/** Lists the bundled per-target `.d.ts` names under a surface's `targets/` dir. */
function listAvailableTargets(targetsDirAbs: string): string[] {
  const names = new Set<string>()
  for (const fileName of listFileNames(targetsDirAbs)) {
    const logical = fileName.endsWith('.gz') ? fileName.slice(0, -3) : fileName
    if (logical.endsWith('.d.ts')) {
      names.add(logical.slice(0, -'.d.ts'.length))
    }
  }
  return [...names].sort()
}

/**
 * Target-specific loading for `@shopify/ui-extensions`: only load the components
 * the target actually imports, plus shared/api/types/event helpers and globals.
 */
function loadTargetSpecificComponents(
  assetRoot: string,
  packageName: string,
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
  extensionSurfaceName: string,
  extensionTarget: string,
  shopifyWebComponents: Set<string>,
): {hasTargetSubpath: boolean; invalidTarget?: InvalidTargetInfo} {
  const surfaceRel = `build/ts/surfaces/${extensionSurfaceName}`
  const targetsDirAbs = joinPath(assetRoot, surfaceRel, 'targets')
  const targetRel = `${surfaceRel}/targets/${extensionTarget}.d.ts`
  const targetContent = readAssetFile(assetRoot, targetRel)

  if (!targetContent) {
    // Either (a) the version has no per-target layout at all (React-era) — fall
    // back to whole-surface loading; or (b) the version ships a targets/ subtree
    // but the requested target isn't in it (typo) — signal invalidTarget so the
    // caller fails loudly.
    if (listFileNames(targetsDirAbs).length > 0 || listSubdirectories(targetsDirAbs).length > 0) {
      return {
        hasTargetSubpath: false,
        invalidTarget: {
          target: extensionTarget,
          surface: extensionSurfaceName,
          supported: listAvailableTargets(targetsDirAbs),
        },
      }
    }
    loadDtsTree(
      assetRoot,
      packageName,
      virtualEnv,
      packageRoot,
      shopifyWebComponents,
      surfaceMatcher(extensionSurfaceName),
    )
    return {hasTargetSubpath: false}
  }

  // Load the surface entry-point sibling file (e.g. `surfaces/admin.d.ts`).
  const surfaceEntryRel = `${surfaceRel}.d.ts`
  const surfaceEntryContent = readAssetFile(assetRoot, surfaceEntryRel)
  if (surfaceEntryContent) {
    addAssetToVirtualEnv(
      virtualEnv,
      packageRoot,
      packageName,
      surfaceEntryRel,
      surfaceEntryContent,
      shopifyWebComponents,
    )
  }

  addAssetToVirtualEnv(virtualEnv, packageRoot, packageName, targetRel, targetContent, shopifyWebComponents)

  const componentsRel = `${surfaceRel}/components`
  for (const componentName of extractComponentImports(targetContent)) {
    const compRel = `${componentsRel}/${componentName}.d.ts`
    const content = readAssetFile(assetRoot, compRel)
    if (content) {
      addAssetToVirtualEnv(virtualEnv, packageRoot, packageName, compRel, content, shopifyWebComponents)
    }
  }

  // Component files import shared types from `./shared` or `./components-shared`.
  for (const sharedFile of ['shared.d.ts', 'components-shared.d.ts']) {
    const sharedRel = `${componentsRel}/${sharedFile}`
    const sharedContent = readAssetFile(assetRoot, sharedRel)
    if (sharedContent) {
      addAssetToVirtualEnv(virtualEnv, packageRoot, packageName, sharedRel, sharedContent, shopifyWebComponents)
    }
  }

  for (const sub of ['api', 'types', 'event']) {
    const subRel = `${surfaceRel}/${sub}`
    loadDtsTree(
      assetRoot,
      packageName,
      virtualEnv,
      packageRoot,
      shopifyWebComponents,
      (rel) => rel === subRel || rel.startsWith(`${subRel}/`),
    )
  }

  for (const filename of ['extension-targets.d.ts', 'globals.d.ts', 'api.d.ts', 'extension.d.ts']) {
    const rel = `${surfaceRel}/${filename}`
    const content = readAssetFile(assetRoot, rel)
    if (content) {
      addAssetToVirtualEnv(virtualEnv, packageRoot, packageName, rel, content, shopifyWebComponents)
    }
  }

  // Top-level entry-point files at `build/ts/*.d.ts` (api, extension, index,
  // preact, shared). Surface files import these via `../../api`, etc.
  loadDtsTree(assetRoot, packageName, virtualEnv, packageRoot, shopifyWebComponents, (rel) => {
    if (!rel.startsWith('build/ts/')) return false
    const rest = rel.slice('build/ts/'.length)
    return rest.endsWith('.d.ts') && !rest.includes('/')
  })

  return {hasTargetSubpath: true}
}

// Injects an ambient .d.ts that re-applies the @shopify/app-bridge-types
// IntrinsicElements augmentation to preact's JSX namespace. app-bridge-types
// augments the *global* JSX namespace, but the virtual env runs with
// `jsxImportSource: "preact"`, so the global augmentation is invisible without
// this shim. Lives under the package root so upward module resolution can reach
// the @shopify/app-bridge-types package.
function addAppBridgePreactJSXShim(virtualEnv: VirtualTSEnvironment, packageRoot: string): void {
  const shimPath = joinPath(packageRoot, '__shims__', 'app-bridge-preact-jsx.d.ts')
  const shimContent = [
    `import type { AppBridgeElements } from "@shopify/app-bridge-types/dist/shopify";`,
    `declare module "preact" {`,
    `  namespace createElement.JSX {`,
    `    interface IntrinsicElements extends AppBridgeElements {}`,
    `  }`,
    `}`,
    ``,
  ].join('\n')
  addFileToVirtualEnv(virtualEnv, shimPath, shimContent)
}

/**
 * Load the types needed to validate a snippet for `api` at `apiVersion`. Reads
 * `<dataDir>/types/index.json` to discover the `(package, version)` set, then
 * populates the language service's virtual filesystem under synthetic
 * `<packageRoot>/node_modules/<pkg>/...` paths.
 */
export function loadTypesIntoTSEnv(input: LoadTypesInput): LoadTypesResult {
  const {api, apiConfig, apiVersion, virtualEnv, extensionTarget, dataDir, catalog} = input

  const missingPackages: string[] = []
  const searchedPaths: string[] = []
  const shopifyWebComponents = new Set<string>()
  let hasTargetSubpath = false
  let invalidTarget: InvalidTargetInfo | undefined

  const isVersioned = apiConfig.versioned === true
  const extensionSurfaceName = apiConfig.extensionSurfaceName

  const typesDir = typesDirFor(dataDir)
  const index = readTypesIndex(dataDir)
  const apiEntry = index[api] as Record<string, PackageRef[]> | undefined
  const supportedVersionNames = (catalog[api] ?? []).map((entry) => entry.name)

  let versionKey: string | undefined
  if (isVersioned) {
    if (apiVersion) {
      if (supportedVersionNames.length > 0 && !supportedVersionNames.includes(apiVersion)) {
        return {
          missingPackages,
          searchedPaths,
          shopifyWebComponents,
          applicablePackageNames: [],
          hasTargetSubpath,
          unsupportedVersion: {requested: apiVersion, supported: supportedVersionNames},
        }
      }
    }
    versionKey = apiVersion ?? catalog[api]?.find((entry) => entry.latestVersion)?.name
  } else {
    versionKey = '_'
  }

  const effectiveApiVersion = isVersioned ? versionKey : undefined
  const applicablePublicEntries = apiConfig.publicPackages.filter((entry) =>
    publicPackageAppliesToVersion(entry, effectiveApiVersion),
  )
  const applicablePackageNames = applicablePublicEntries.map(getPublicPackageName)
  const excludedPublicPackageNames = new Set(
    apiConfig.publicPackages
      .filter((entry) => !publicPackageAppliesToVersion(entry, effectiveApiVersion))
      .map(getPublicPackageName),
  )

  // Defense in depth against a stale index.json: drop refs naming a
  // publicPackage that doesn't apply to this version. Transitive deps (not in
  // publicPackages) pass through untouched.
  const rawApiPackages: PackageRef[] = versionKey ? (apiEntry?.[versionKey] ?? []) : []
  const apiPackages: PackageRef[] = rawApiPackages.filter((ref) => !excludedPublicPackageNames.has(ref.package))

  if (apiPackages.length === 0 && applicablePublicEntries.length > 0) {
    for (const entry of applicablePublicEntries) {
      const pkg = getPublicPackageName(entry)
      missingPackages.push(pkg)
      searchedPaths.push(joinPath(typesDir, pkg, versionKey ?? '<unknown-version>'))
    }
  }

  const alwaysLoaded = index._always_loaded ?? []
  const allPackages: PackageRef[] = [...apiPackages, ...alwaysLoaded]

  const packageRoot = virtualEnv.servicesHost.getCurrentDirectory()

  for (const {package: pkg, version} of allPackages) {
    const assetRoot = joinPath(typesDir, pkg, version)
    const pkgJsonContent = readAssetFile(assetRoot, 'package.json')
    if (pkgJsonContent === undefined) {
      missingPackages.push(pkg)
      searchedPaths.push(assetRoot)
      continue
    }

    addAssetToVirtualEnv(virtualEnv, packageRoot, pkg, 'package.json', pkgJsonContent)

    synthesizeNestedPackageJsons(assetRoot, pkg, virtualEnv, packageRoot)

    if (pkg === '@shopify/ui-extensions' && extensionSurfaceName) {
      if (extensionTarget) {
        const targetResult = loadTargetSpecificComponents(
          assetRoot,
          pkg,
          virtualEnv,
          packageRoot,
          extensionSurfaceName,
          extensionTarget,
          shopifyWebComponents,
        )
        hasTargetSubpath = targetResult.hasTargetSubpath
        if (targetResult.invalidTarget) {
          invalidTarget = targetResult.invalidTarget
        }
      } else {
        loadDtsTree(assetRoot, pkg, virtualEnv, packageRoot, shopifyWebComponents, surfaceMatcher(extensionSurfaceName))
      }
    } else if (pkg === '@shopify/ui-extensions-react' && extensionSurfaceName) {
      // The React bindings tarball is deduped across all four UI surfaces, so
      // filter to the relevant surface subtree.
      loadDtsTree(assetRoot, pkg, virtualEnv, packageRoot, shopifyWebComponents, surfaceMatcher(extensionSurfaceName))
    } else {
      loadDtsTree(assetRoot, pkg, virtualEnv, packageRoot, shopifyWebComponents)
    }

    if (pkg === '@shopify/app-bridge-types') {
      addAppBridgePreactJSXShim(virtualEnv, packageRoot)
    }
  }

  return {
    missingPackages,
    searchedPaths,
    shopifyWebComponents,
    applicablePackageNames,
    hasTargetSubpath,
    invalidTarget,
  }
}
