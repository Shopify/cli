import type {AgentFindingsDocument, DeterministicFindingsDocument} from '../../types.js'

/**
 * Representative stored documents, as `check` and `record` write them. Shared by the translation,
 * combination, review and submit tests, so keep their shape stable and realistic: every check ID is a
 * real catalog entry. Checks in both sources cover both precedences: CREDENTIAL_LOG_LEAKAGE is
 * `prefer-agent`; MISSING_TENANT_ISOLATION and OPEN_REDIRECT are `union`.
 */

export const deterministicFindingsDocument: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '3.99.0', ruleset: 'app-security-rules@3.99.0'},
  generated_at: '2026-09-01T10:00:00.000Z',
  project: {commit: 'a'.repeat(40), dirty: false},
  detection: {
    framework: 'react_router',
    surface: 'react_router',
    languages: [{name: 'typescript', support: 'supported', files: ['app/routes/orders.tsx', 'app/shopify.server.ts']}],
  },
  coverage: {
    files_scanned: 12,
    files_skipped: [{path: 'public/vendor.min.js', reason: 'too_large', size_bytes: 2_500_000}],
    gaps: [
      {
        code: 'skipped_file',
        message: 'public/vendor.min.js was not scanned (too_large).',
        file: 'public/vendor.min.js',
      },
      {
        code: 'unresolved_check',
        message: 'MISSING_TENANT_ISOLATION applies to app source, but the parser was unavailable.',
        check_id: 'MISSING_TENANT_ISOLATION',
      },
    ],
  },
  checks: [
    {
      id: 'CREDENTIAL_LOG_LEAKAGE',
      version: 1,
      status: 'executed',
      analysis_mode: 'ast',
      snapshot: {
        title: 'Credential reaches a log sink',
        severity: 'high',
        description: 'Detects direct credential flows to console and logger sinks.',
        current_version: 1,
      },
      findings: [
        {
          location: {file: 'app/routes/orders.tsx', line: 12, column: 5},
          message: 'accessToken flows into console.log.',
          evidence: [{location: {file: 'app/routes/orders.tsx', line: 12}, quote: 'console.log(session.accessToken)'}],
          snippet: 'console.log(session.accessToken)',
          fix: {
            automated: false,
            description: 'Remove credentials from logs; emit only safe redacted, hashed, or boolean-derived values.',
          },
        },
        {
          location: {file: 'app/shopify.server.ts', line: 40},
          message: 'apiSecretKey flows into logger.info.',
          evidence: [{location: {file: 'app/shopify.server.ts', line: 40}}],
          fix: {
            automated: false,
            description: 'Remove credentials from logs; emit only safe redacted, hashed, or boolean-derived values.',
          },
        },
      ],
    },
    {
      id: 'EOL_API_VERSION',
      version: 1,
      status: 'executed',
      analysis_mode: 'structured_config',
      snapshot: {
        title: 'End-of-life API version',
        severity: 'low',
        description:
          'Detects parsed config and React Router server API versions past the 12-month support window and 30-day grace period.',
        guide: 'https://shopify.dev/docs/api/usage/versioning',
        current_version: 1,
      },
      findings: [
        {
          location: {file: 'shopify.app.toml', line: 8},
          message: 'api_version 2024-01 is past its support window.',
          evidence: [{location: {file: 'shopify.app.toml', line: 8}, quote: 'api_version = "2024-01"'}],
          fix: {
            automated: false,
            description: 'Update api_version in shopify.app.toml and the ApiVersion enum in shopify.server.ts.',
            guide: 'https://shopify.dev/docs/api/usage/versioning',
          },
        },
      ],
    },
    {
      id: 'MISSING_TENANT_ISOLATION',
      version: 4,
      status: 'unresolved',
      reason: {code: 'parser_unavailable', message: 'The TypeScript parser was unavailable for app/routes/orders.tsx.'},
      analysis_mode: 'ast',
      snapshot: {
        title: 'Database query may not be scoped by shop',
        severity: 'high',
        description:
          "Detects database queries in authenticated routes that don't reference the shop domain or session.",
        guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
        current_version: 4,
      },
      findings: [],
    },
    {
      id: 'OPEN_REDIRECT',
      version: 2,
      status: 'executed',
      analysis_mode: 'ast',
      snapshot: {
        title: 'Open redirect in auth callback',
        severity: 'medium',
        description: 'Detects redirect targets taken from request parameters without validation.',
        guide: 'https://shopify.dev/docs/apps/build/authentication-authorization',
        current_version: 2,
      },
      findings: [],
    },
    {
      id: 'UNSAFE_INNERHTML',
      version: 1,
      status: 'not_applicable',
      reason: {code: 'capability_absent', message: 'Capability theme_app_extension was not detected.'},
      analysis_mode: 'regex',
      snapshot: {
        title: 'Unsafe HTML assignment',
        severity: 'high',
        description: 'Detects innerHTML, outerHTML, and insertAdjacentHTML receiving non-literal values.',
        guide: 'https://shopify.dev/docs/apps/online-store/security#xss-prevention',
        current_version: 1,
      },
      findings: [],
    },
  ],
}

export const agentFindingsDocument: AgentFindingsDocument = {
  schema_version: 1,
  source: 'agent',
  engine: {name: 'shopify-app-security', version: '3.99.0'},
  generated_at: '2026-09-01T11:30:00.000Z',
  project: {commit: 'a'.repeat(40), dirty: true},
  checks: [
    {
      id: 'CREDENTIAL_LOG_LEAKAGE',
      version: 1,
      status: 'executed',
      snapshot: {
        title: 'Credential reaches a log sink',
        severity: 'high',
        description: 'Detects direct credential flows to console and logger sinks.',
        current_version: 1,
        precedence: 'prefer-agent',
      },
      findings: [
        {
          location: {file: 'app/routes/orders.tsx', line: 12},
          message: 'The session access token is written to the server log.',
          evidence: [{location: {file: 'app/routes/orders.tsx', line: 12}, quote: 'console.log(session.accessToken)'}],
          confidence: 'high',
          reasoning: 'The logged object is the authenticated session, whose accessToken is a live credential.',
        },
      ],
    },
    {
      id: 'MISSING_TENANT_ISOLATION',
      version: 4,
      status: 'executed',
      snapshot: {
        title: 'Database query may not be scoped by shop',
        severity: 'high',
        description:
          "Detects database queries in authenticated routes that don't reference the shop domain or session.",
        guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
        current_version: 4,
        precedence: 'union',
      },
      findings: [
        {
          location: {file: 'app/routes/orders.tsx', line: 31},
          message: 'Orders are loaded for every shop: the query has no shop filter.',
          evidence: [
            {location: {file: 'app/routes/orders.tsx', line: 31}, quote: 'prisma.order.findMany()'},
            {
              location: {file: 'app/routes/orders.tsx', line: 18},
              quote: 'const {session} = await authenticate.admin(request)',
            },
          ],
          snippet: 'const orders = await prisma.order.findMany()',
          confidence: 'high',
          reasoning: 'The loader authenticates the shop but never uses session.shop in the query.',
        },
        {
          location: {file: 'app/routes/admin.settings.tsx', line: 55},
          message: 'Settings are deleted by id without checking the owning shop.',
          evidence: [{location: {file: 'app/routes/admin.settings.tsx', line: 55}}],
          confidence: 'medium',
          suppression: {justification: 'The route is restricted to the app owner by an allowlist middleware.'},
        },
      ],
    },
    {
      id: 'OPEN_REDIRECT',
      version: 2,
      status: 'not_applicable',
      reason: {code: 'no_redirects', message: 'The app never redirects to a request-controlled destination.'},
      snapshot: {
        title: 'Open redirect in auth callback',
        severity: 'medium',
        description: 'Detects redirect targets taken from request parameters without validation.',
        guide: 'https://shopify.dev/docs/apps/build/authentication-authorization',
        current_version: 2,
        precedence: 'union',
      },
      findings: [],
    },
    {
      id: 'UNAUTHENTICATED_ENDPOINT',
      version: 2,
      status: 'unresolved',
      reason: {
        code: 'needs_runtime',
        message: 'Route registration happens at runtime and could not be traced statically.',
      },
      snapshot: {
        title: 'Route handler lacks recognized auth verification',
        severity: 'high',
        description:
          'Uses the template route-auth heuristic, with agent review for context.shopify.authenticate.admin calls instead of treating them as missing authentication.',
        guide: 'https://shopify.dev/docs/apps/auth',
        current_version: 2,
        precedence: 'union',
      },
      findings: [],
    },
  ],
}
