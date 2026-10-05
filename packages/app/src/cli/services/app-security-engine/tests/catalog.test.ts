import {CHECK_DOCS_BASE_URL, RULE_CATALOG, checkDocsUrl} from '../rules/catalog.js'
import {describe, expect, test} from 'vitest'

/**
 * The check pages under shopify.dev/docs/apps/build/security/app-security-checks, one per catalog check.
 * Add, rename or remove a page here when the catalog and the docs change together.
 */
const DOCS_PAGE_SLUGS = [
  'active-uploads-and-privileged-previews',
  'app-proxy-liquid-injection',
  'app-proxy-unverified-signature',
  'committed-secret',
  'credential-browser-leakage',
  'credential-log-leakage',
  'cross-site-scripting',
  'csrf-missing-protection',
  'dependency-reachability',
  'deprecated-script-tag-scope',
  'eol-api-version',
  'expiring-offline-token',
  'insecure-webhook-url',
  'liquid-unsafe-render',
  'metafield-offline-token',
  'missing-authorization-check',
  'missing-compliance-webhooks',
  'missing-dependency-security-automation',
  'missing-embedded-csp',
  'missing-tenant-isolation',
  'open-redirect',
  'overbroad-data-access',
  'request-controlled-admin-context',
  'request-derived-shop-scope',
  'scope-over-request',
  'script-tag-url-injection',
  'session-lifecycle-and-replay',
  'sql-injection',
  'ssrf-request-forgery',
  'static-frame-ancestors',
  'text-setting-html-smuggling',
  'theme-extension-xss',
  'unauthenticated-endpoint',
  'unsafe-innerhtml',
  'unscoped-shop-config-write',
  'weak-shop-validation',
]

const docsPageSlug = (url: string) => url.slice(`${CHECK_DOCS_BASE_URL}/`.length)

describe('check docs URLs', () => {
  test('gives every catalog check a page under the app security checks docs', () => {
    for (const entry of RULE_CATALOG) {
      expect(entry.docsUrl.startsWith(`${CHECK_DOCS_BASE_URL}/`), entry.id).toBe(true)
    }
  })

  test("names each check's page after its ID", () => {
    for (const entry of RULE_CATALOG) {
      expect(docsPageSlug(entry.docsUrl), entry.id).toBe(entry.id.toLowerCase().replaceAll('_', '-'))
    }
  })

  test('has exactly one catalog check for every docs page', () => {
    expect(RULE_CATALOG.map((entry) => docsPageSlug(entry.docsUrl)).sort()).toEqual(DOCS_PAGE_SLUGS)
  })

  test('looks up the docs URL of a check by ID', () => {
    expect(checkDocsUrl('COMMITTED_SECRET')).toBe(`${CHECK_DOCS_BASE_URL}/committed-secret`)
    expect(checkDocsUrl('UNKNOWN_CHECK')).toBeUndefined()
  })
})
