import type {Severity, Capabilities} from '../types.js'

/** The shopify.dev section that has one page per check. */
export const CHECK_DOCS_BASE_URL = 'https://shopify.dev/docs/apps/build/security/app-security-checks'

export interface RuleCatalogEntry {
  id: string
  title: string
  severity: Severity
  points: number
  description: string
  fix: string
  guide?: string
  requires?: keyof Capabilities
  status?: 'active' | 'planned' | 'investigate'
  /** The check's page on shopify.dev, which explains the issue and shows how to fix it. */
  docsUrl: string
}

export const RULE_CATALOG: RuleCatalogEntry[] = [
  {
    id: 'DEPRECATED_SCRIPT_TAG_SCOPE',
    title: 'Deprecated ScriptTag capability',
    severity: 'medium',
    points: -10,
    description: 'Detects the deprecated write_script_tags OAuth scope in shopify.app.toml.',
    fix: 'Remove write_script_tags from scopes and migrate to app embeds.',
    guide: 'https://shopify.dev/docs/apps/online-store/app-embeds',
    docsUrl: `${CHECK_DOCS_BASE_URL}/deprecated-script-tag-scope`,
  },
  {
    id: 'SCOPE_OVER_REQUEST',
    title: 'OAuth scope may be over-requested',
    severity: 'high',
    points: -12,
    description: "Detects declared OAuth scopes that don't appear to be used by the app code.",
    fix: 'Remove unused scopes or add the code path that needs them.',
    guide: 'https://shopify.dev/docs/api/usage/access-scopes',
    docsUrl: `${CHECK_DOCS_BASE_URL}/scope-over-request`,
  },
  {
    id: 'UNSAFE_INNERHTML',
    title: 'Unsafe HTML assignment',
    severity: 'high',
    points: -25,
    description: 'Detects innerHTML, outerHTML, and insertAdjacentHTML receiving non-literal values.',
    fix: 'Use textContent where possible or sanitize with DOMPurify before rendering.',
    guide: 'https://shopify.dev/docs/apps/online-store/security#xss-prevention',
    requires: 'theme_app_extension',
    docsUrl: `${CHECK_DOCS_BASE_URL}/unsafe-innerhtml`,
  },
  {
    id: 'LIQUID_UNSAFE_RENDER',
    title: 'Unsafe Liquid metafield or setting output',
    severity: 'medium',
    points: -10,
    description: 'Detects metafield and merchant-setting output without context-appropriate escaping or serialization.',
    fix: 'Use escape for HTML text/attributes, json for JavaScript data, or metafield_tag for supported rich content.',
    requires: 'theme_app_extension',
    docsUrl: `${CHECK_DOCS_BASE_URL}/liquid-unsafe-render`,
  },
  {
    id: 'INSECURE_WEBHOOK_URL',
    title: 'Configured callback URL is not HTTPS',
    severity: 'high',
    points: -12,
    description: 'Detects webhook subscriptions and OAuth redirect URLs configured with unsafe absolute URLs.',
    fix: 'Use HTTPS or a supported Shopify-relative path for every configured callback URL.',
    guide: 'https://shopify.dev/docs/apps/webhooks',
    docsUrl: `${CHECK_DOCS_BASE_URL}/insecure-webhook-url`,
  },
  {
    id: 'COMMITTED_SECRET',
    title: 'Committed secret or environment file',
    severity: 'high',
    points: -50,
    description: 'Detects environment files and common API key/token patterns in source files.',
    fix: 'Remove committed secrets, rotate exposed values, and store them in environment variables.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/committed-secret`,
  },

  {
    id: 'CREDENTIAL_LOG_LEAKAGE',
    title: 'Credential reaches a log sink',
    severity: 'high',
    points: -20,
    description: 'Detects direct credential flows to console and logger sinks.',
    fix: 'Remove credentials from logs; emit only safe redacted, hashed, or boolean-derived values.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/credential-log-leakage`,
  },
  {
    id: 'CREDENTIAL_BROWSER_LEAKAGE',
    title: 'Credential reaches the client browser',
    severity: 'high',
    points: -20,
    description: 'Detects direct credential flows into responses, loaders, globals, DOM, and external requests.',
    fix: 'Keep credentials server-side and return only non-sensitive derived data.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/credential-browser-leakage`,
  },

  {
    id: 'EXPIRING_OFFLINE_TOKEN',
    title: 'Expiring offline access tokens explicitly disabled',
    severity: 'medium',
    points: -10,
    description:
      'Verifies React Router expiring offline-token configuration and refresh-metadata storage compatibility.',
    fix: 'Enable expiringOfflineAccessTokens and ensure session storage persists expiry and refresh metadata.',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
    docsUrl: `${CHECK_DOCS_BASE_URL}/expiring-offline-token`,
  },
  {
    id: 'METAFIELD_OFFLINE_TOKEN',
    title: 'Metafield write in an unverified offline token context',
    severity: 'high',
    points: -15,
    description:
      'Investigates metafield and metaobject writes made with an offline Admin API context that no verified request for the same shop authorizes.',
    fix: 'Make the write from a request verified with authenticate.admin(request), or derive the shop and values from a verified source.',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/online-access-tokens',
    docsUrl: `${CHECK_DOCS_BASE_URL}/metafield-offline-token`,
  },
  {
    id: 'MISSING_EMBEDDED_CSP',
    title: 'Embedded app missing frame-ancestors CSP directive',
    severity: 'medium',
    points: -10,
    description: 'Detects embedded apps that set document response headers but omit frame-ancestors.',
    fix: 'Add frame-ancestors to CSP, restricted to the authenticated shop domain and admin.shopify.com.',
    guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
    docsUrl: `${CHECK_DOCS_BASE_URL}/missing-embedded-csp`,
  },
  {
    id: 'MISSING_COMPLIANCE_WEBHOOKS',
    title: 'Missing mandatory GDPR compliance webhooks',
    severity: 'medium',
    points: -10,
    description:
      'Detects apps missing mandatory compliance webhooks (shop/redact, customers/data_request, customers/redact).',
    fix: 'Add the missing webhook subscriptions to shopify.app.toml.',
    guide: 'https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks',
    docsUrl: `${CHECK_DOCS_BASE_URL}/missing-compliance-webhooks`,
  },
  {
    id: 'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
    title: 'Repository-level dependency management configuration not detected',
    severity: 'low',
    points: -5,
    description:
      'Looks for a local Dependabot or Renovate configuration file at the repository root without validating its contents.',
    fix: 'Add a Dependabot or Renovate configuration file at the repository root, or verify existing coverage.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/missing-dependency-security-automation`,
  },
  {
    id: 'EOL_API_VERSION',
    title: 'End-of-life API version',
    severity: 'low',
    points: -5,
    description:
      'Detects parsed config and React Router server API versions past the 12-month support window and 30-day grace period.',
    fix: 'Update api_version in shopify.app.toml and the ApiVersion enum in shopify.server.ts.',
    guide: 'https://shopify.dev/docs/api/usage/versioning',
    docsUrl: `${CHECK_DOCS_BASE_URL}/eol-api-version`,
  },
  {
    id: 'WEAK_SHOP_VALIDATION',
    title: 'Shop domain validation regex is not anchored',
    severity: 'high',
    points: -15,
    description: 'Detects unanchored myshopify.com regexes that allow domain spoofing and token theft.',
    fix: 'Anchor the regex with ^ and $ to prevent prefix/suffix attacks.',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/get-access-tokens/oauth',
    docsUrl: `${CHECK_DOCS_BASE_URL}/weak-shop-validation`,
  },
  {
    id: 'APP_PROXY_LIQUID_INJECTION',
    title: 'App proxy Liquid injection risk',
    severity: 'high',
    points: -20,
    description:
      'Detects app proxy endpoints that interpolate request parameters into active Liquid or HTML responses.',
    fix: "Don't interpolate user input into application/liquid responses. Use application/json or escape all input.",
    guide: 'https://shopify.dev/docs/apps/online-store/app-proxies',
    docsUrl: `${CHECK_DOCS_BASE_URL}/app-proxy-liquid-injection`,
  },
  {
    id: 'MISSING_TENANT_ISOLATION',
    title: 'Database query may not be scoped by shop',
    severity: 'high',
    points: -20,
    description: "Detects database queries in authenticated routes that don't reference the shop domain or session.",
    fix: "Add the authenticated shop to the query's where clause.",
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
    docsUrl: `${CHECK_DOCS_BASE_URL}/missing-tenant-isolation`,
  },

  {
    id: 'OPEN_REDIRECT',
    title: 'Open redirect in auth callback',
    severity: 'medium',
    points: -12,
    description: 'Detects redirect targets taken from request parameters without validation.',
    fix: 'Validate the redirect URL against an allowlist of permitted domains.',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization',
    docsUrl: `${CHECK_DOCS_BASE_URL}/open-redirect`,
  },
  {
    id: 'UNAUTHENTICATED_ENDPOINT',
    title: 'Route handler lacks recognized auth verification',
    severity: 'high',
    points: -15,
    description:
      'Uses the template route-auth heuristic, with agent review for context.shopify.authenticate.admin calls instead of treating them as missing authentication.',
    fix: 'Complete the verification appropriate to the entry point before protected operations, and stop those operations when verification fails.',
    guide: 'https://shopify.dev/docs/apps/auth',
    requires: 'has_backend',
    docsUrl: `${CHECK_DOCS_BASE_URL}/unauthenticated-endpoint`,
  },
  {
    id: 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
    title: 'Request input selects Admin API shop context',
    severity: 'high',
    points: -20,
    description:
      "Detects request-derived shop values passed into unauthenticated.admin(...), allowing callers to select another shop's Admin API context.",
    fix: 'Use the Admin API context returned by authenticate.admin(request). Never pass form, JSON, query, or route input into unauthenticated.admin(...).',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/online-access-tokens',
    docsUrl: `${CHECK_DOCS_BASE_URL}/request-controlled-admin-context`,
  },

  {
    id: 'APP_PROXY_UNVERIFIED_SIGNATURE',
    title: 'App proxy request trusted without signature verification',
    severity: 'high',
    points: -15,
    description: 'Detects app proxy parameters read without visible signature verification.',
    fix: 'Verify app proxy signatures before trusting shop, customer, or path parameters.',
    guide: 'https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies',
    requires: 'app_proxy',
    docsUrl: `${CHECK_DOCS_BASE_URL}/app-proxy-unverified-signature`,
  },
  {
    id: 'REQUEST_DERIVED_SHOP_SCOPE',
    title: 'Query scoped by shop value taken from request input',
    severity: 'high',
    points: -15,
    description:
      'Detects queries whose shop scope comes from request params rather than the authenticated session. Presence of a shop key is not proof of scoping when its value is attacker-controlled.',
    fix: 'Scope the query with the shop from the authenticated session, or verify the supplied shop against a signed session or HMAC first.',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
    docsUrl: `${CHECK_DOCS_BASE_URL}/request-derived-shop-scope`,
  },
  {
    id: 'UNSCOPED_SHOP_CONFIG_WRITE',
    title: 'Config write trusts shop from request input',
    severity: 'high',
    points: -15,
    description:
      'Detects settings or metafield writes scoped by request-controlled shop input without visible auth verification.',
    fix: 'Derive the target shop from an authenticated session or verified HMAC.',
    guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
    docsUrl: `${CHECK_DOCS_BASE_URL}/unscoped-shop-config-write`,
  },
  {
    id: 'STATIC_FRAME_ANCESTORS',
    title: 'Embedded app frame-ancestors uses a wildcard',
    severity: 'high',
    points: -12,
    description:
      'Detects wildcard or static cross-shop frame-ancestors policies in embedded app code, whether written literally or built from variables.',
    fix: 'Restrict frame-ancestors to Shopify Admin and the authenticated shop origin.',
    guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
    requires: 'embedded_app',
    docsUrl: `${CHECK_DOCS_BASE_URL}/static-frame-ancestors`,
  },
  {
    id: 'ACTIVE_UPLOADS_AND_PRIVILEGED_PREVIEWS',
    title: 'Active upload or privileged preview may execute untrusted content',
    severity: 'high',
    points: -15,
    description:
      'Investigates uploaded or imported active content that may execute in storefront, embedded admin, customer-account, or operator preview surfaces.',
    fix: 'Sanitize or re-encode active content and isolate previews from privileged origins.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/active-uploads-and-privileged-previews`,
  },
  {
    id: 'DEPENDENCY_REACHABILITY',
    title: 'Vulnerable dependency may be reachable in app code',
    severity: 'medium',
    points: -10,
    description:
      'Investigates whether a vulnerable dependency version is actually used through the affected API, helper, or configuration.',
    fix: 'Upgrade the dependency or remove the reachable vulnerable code path.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/dependency-reachability`,
  },
  {
    id: 'SESSION_LIFECYCLE_AND_REPLAY',
    title: 'Session lifecycle or replay control may be missing',
    severity: 'high',
    points: -15,
    description:
      'Investigates stale sessions, replayable signed links, and missing invalidation or idempotency across lifecycle transitions.',
    fix: 'Invalidate stale authority and enforce replay protection or re-authorization before sensitive actions.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/session-lifecycle-and-replay`,
  },
  {
    id: 'OVERBROAD_DATA_ACCESS',
    title: 'Data access may exceed the current request',
    severity: 'medium',
    points: -10,
    description: 'Investigates reads that may expose data outside the authenticated shop or user boundary.',
    fix: 'Scope data access to the authenticated shop and minimum necessary records.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/overbroad-data-access`,
  },
  {
    id: 'CROSS_SITE_SCRIPTING',
    title: 'Cross-site scripting risk',
    severity: 'high',
    points: -15,
    description: 'Investigates lower-trust data rendered as executable browser content in app-owned pages.',
    fix: 'Use context-appropriate escaping, safe serialization, URL validation, or HTML sanitization at the final sink.',
    guide: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
    docsUrl: `${CHECK_DOCS_BASE_URL}/cross-site-scripting`,
  },
  {
    id: 'SQL_INJECTION',
    title: 'SQL injection risk',
    severity: 'high',
    points: -15,
    description: 'Investigates lower-trust input that changes SQL syntax in a reachable database operation.',
    fix: 'Bind query values and use trusted mappings or safe identifier quoting for dynamic SQL structure.',
    guide: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
    docsUrl: `${CHECK_DOCS_BASE_URL}/sql-injection`,
  },
  {
    id: 'SSRF_REQUEST_FORGERY',
    title: 'Server-side request forgery risk',
    severity: 'high',
    points: -15,
    description: 'Investigates server-side requests whose destinations may be controlled by request input.',
    fix: 'Allowlist destinations and reject private, local, and unsafe network targets.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/ssrf-request-forgery`,
  },
  {
    id: 'THEME_EXTENSION_XSS',
    title: 'Theme extension cross-site scripting risk',
    severity: 'high',
    points: -15,
    description: 'Investigates untrusted values rendered without safe escaping in theme extensions.',
    fix: 'Escape untrusted values and avoid raw HTML rendering.',
    requires: 'theme_app_extension',
    docsUrl: `${CHECK_DOCS_BASE_URL}/theme-extension-xss`,
  },
  {
    id: 'CSRF_MISSING_PROTECTION',
    title: 'Cross-site request forgery protection may be missing',
    severity: 'medium',
    points: -10,
    description: 'Investigates state-changing endpoints for missing request authenticity protections.',
    fix: 'Require an authenticated session and CSRF protection on state-changing requests.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/csrf-missing-protection`,
  },
  {
    id: 'MISSING_AUTHORIZATION_CHECK',
    title: 'Authorization check may be missing',
    severity: 'high',
    points: -15,
    description: 'Investigates authenticated handlers that may not authorize access to the requested resource.',
    fix: 'Authorize the actor and resource after authentication.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/missing-authorization-check`,
  },
  {
    id: 'SCRIPT_TAG_URL_INJECTION',
    title: 'ScriptTag URL may be request controlled',
    severity: 'high',
    points: -15,
    description: 'Investigates ScriptTag writes whose source URL may be controlled by untrusted input.',
    fix: 'Remove ScriptTag usage or restrict sources to trusted versioned assets.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/script-tag-url-injection`,
  },
  {
    id: 'TEXT_SETTING_HTML_SMUGGLING',
    title: 'Text setting may be rendered as unsafe HTML',
    severity: 'high',
    points: -15,
    description: 'Investigates merchant-configurable text rendered as HTML without sanitization.',
    fix: 'Render settings as text or sanitize with a strict allowlist.',
    docsUrl: `${CHECK_DOCS_BASE_URL}/text-setting-html-smuggling`,
  },
]

/** The shopify.dev page of a check, or undefined when the catalog doesn't know the ID. */
export function checkDocsUrl(checkId: string): string | undefined {
  return RULE_CATALOG.find((entry) => entry.id === checkId)?.docsUrl
}
