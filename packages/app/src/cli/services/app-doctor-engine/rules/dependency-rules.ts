import type {Issue} from '../types.js'
import type {ManifestFile} from './types.js'

/** Rule 9: OUTDATED_SHOPIFY_SDK (-5, medium) */
export function scanOutdatedShopifySdk(manifests: ManifestFile[]): Issue[] {
  const issues: Issue[] = []

  const shopifyPackages: Record<string, string> = {
    // Current major versions.
    '@shopify/shopify-api': '12',
    '@shopify/shopify-app-remix': '4',
    '@shopify/app-bridge-react': '4',
    '@shopify/shopify-app-express': '2',
    '@shopify/shopify-app-session-storage-prisma': '8',
  }

  for (const manifest of manifests) {
    if (manifest.type !== 'npm') continue
    const deps = {...manifest.dependencies, ...manifest.devDependencies}

    for (const [pkg, currentMajor] of Object.entries(shopifyPackages)) {
      if (!(pkg in deps)) continue
      const version = deps[pkg]
      if (version === undefined) continue
      const major = extractMajorVersion(version)
      if (major === null) continue

      if (major < Number(currentMajor)) {
        issues.push({
          id: 'OUTDATED_SHOPIFY_SDK',
          severity: 'medium',
          points: -5,
          title: `Outdated Shopify SDK: ${pkg}`,
          message: `${pkg}@${version} is behind the current major version (${currentMajor}.x). Update to get security patches and new features.`,
          location: {file: manifest.path},
          fix: {
            automated: false,
            description: `Update ${pkg} to the latest version`,
            guide: 'https://shopify.dev/docs/apps/tools/sdk',
          },
        })
      }
    }
  }

  return issues
}

/** Rule 10: KNOWN_CVE_IN_DEPENDENCY (-8, high) */
export function scanKnownCves(manifests: ManifestFile[]): Issue[] {
  const issues: Issue[] = []

  // Known vulnerable versions (curated list for Phase 1)
  // In production, this would shell out to `npm audit` or use a CVE database
  const knownVulnerable: Record<string, Record<string, string>> = {
    lodash: {
      '4.17.15': 'CVE-2019-10744, CVE-2020-8203 (prototype pollution)',
      '4.17.11': 'CVE-2019-10744',
      '4.17.4': 'CVE-2018-3721',
    },
    minimatch: {
      '3.0.4': 'CVE-2022-3517 (ReDoS)',
      '3.0.1': 'CVE-2022-3517',
    },
    jquery: {
      '3.4.0': 'CVE-2020-11022, CVE-2020-11023 (XSS)',
      '3.3.1': 'CVE-2015-9251',
      '2.2.4': 'CVE-2015-9251',
    },
    handlebars: {
      '4.5.3': 'CVE-2019-19919 (template injection)',
      '4.3.0': 'CVE-2019-19919',
      '4.1.2': 'CVE-2021-23383',
    },
    validator: {
      '13.6.0': 'CVE-2021-37624',
    },
    atob: {
      '2.1.0': 'CVE-2021-44910',
    },
    marked: {
      '0.8.0': 'CVE-2021-21330',
      '1.2.7': 'CVE-2021-21330',
    },
  }

  for (const manifest of manifests) {
    if (manifest.type !== 'npm') continue
    const deps = {...manifest.dependencies, ...manifest.devDependencies}

    for (const [pkg, versionMap] of Object.entries(knownVulnerable)) {
      if (!(pkg in deps)) continue
      const version = deps[pkg]
      if (version === undefined) continue
      const exactVersion = extractExactVersion(version)
      if (exactVersion && exactVersion in versionMap) {
        issues.push({
          id: 'KNOWN_CVE_IN_DEPENDENCY',
          severity: 'high',
          points: -8,
          title: `Known CVE in ${pkg}@${exactVersion}`,
          message: `${pkg}@${exactVersion} has known vulnerabilities: ${versionMap[exactVersion]}. Update to a patched version.`,
          location: {file: manifest.path},
          fix: {
            automated: false,
            description: `Update ${pkg} to the latest patched version`,
          },
        })
      }
    }
  }

  return issues
}

function extractMajorVersion(versionSpec: string): number | null {
  // Handle ^1.0.0, ~2.3.0, >=3.0.0, 1.0.0, etc.
  const match = versionSpec.match(/(\d+)/)
  return match?.[1] === undefined ? null : Number(match[1])
}

function extractExactVersion(versionSpec: string): string | null {
  // Handle exact versions: "4.17.15" or "4.17.15"
  const match = versionSpec.match(/^[\^~>=]*((\d+)\.(\d+)\.(\d+))/)
  return match?.[1] ?? null
}
