type TestStatus = 'passed' | 'failed' | 'skipped'

export interface AssertionResult {
  description: string
  passed: boolean
  expected?: unknown
  actual?: unknown
}

export interface TestResult {
  name: string
  status: TestStatus
  duration: number
  assertions: AssertionResult[]
  error?: Error
}

export interface AuditContext {
  // Working directory for tests (user's current directory)
  workingDirectory: string
  // Environment name from shopify.theme.toml (required)
  environment: string
  // Store URL (from environment or flags)
  store?: string
  // Password/token for Theme Access app
  password?: string
  // Theme name created during init
  themeName?: string
  // Theme path after init
  themePath?: string
  // Theme ID after push
  themeId?: string
  // Custom data that tests can share
  data: {[key: string]: unknown}
}

export interface ThemeAuditOptions {
  // Working directory (defaults to cwd)
  path?: string
  // Environment name from shopify.theme.toml (required)
  environment: string
  // Store URL (overrides environment)
  store?: string
  // Password/token (overrides environment)
  password?: string
}
