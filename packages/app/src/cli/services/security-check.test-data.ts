import type {AppSecurityExecution} from './app-security-api.js'
import type {AgentChecks, DeterministicFindingsDocument, Issue, ScanResult} from './app-security-engine/index.js'

export const scan: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  app: {name: 'Test', type: 'public'},
  detection: {framework: 'none', surface: 'config_only', languages: []},
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    embedded_app: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: false,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    security_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_gaps: [],
    checks_executed: [],
  },
  issues: [],
}

const engine = {
  name: 'shopify-app-security',
  version: '1.2.3',
  ruleset: '2026.08.28',
}

export const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '1.2.3', ruleset: '2026.08.28'},
  generated_at: '2026-08-24T00:00:00.000Z',
  detection: scan.detection,
  coverage: {
    files_scanned: 1,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [],
}

export const agentChecks: AgentChecks = {
  schema_version: 1,
  engine: {name: 'shopify-app-security', version: '1.2.3'},
  generated_at: '2026-08-24T00:00:00.000Z',
  checks: Array.from({length: 31}, (_, index) => ({
    id: `CHECK_${index}`,
    version: 1,
    prompt: 'prompt',
    severity: 'medium' as const,
    docs_url: `https://shopify.dev/docs/apps/build/security/app-security-checks/check-${index}`,
  })),
  instructions: 'review',
}

/** A scan without issues, with 31 agent checks, as `executeAppSecurity` returns it. */
export const scanExecution: AppSecurityExecution = {
  scan,
  ignoredScanDirectories: [],
  otherAppDirectories: [],
  deterministicFindings,
  agentChecks,
  engine,
  elapsedMilliseconds: 12,
}

export const committedSecretIssue: Issue = {
  id: 'COMMITTED_SECRET',
  severity: 'high',
  points: -25,
  title: 'Secret',
  message: 'secret',
  location: {file: 'app/routes/index.ts'},
  fix: {automated: false, description: 'remove it'},
}
