/**
 * Rule for sanitizing sensitive data from error messages.
 */
interface SanitizationRule {
  /** The regex pattern to match sensitive data. */
  pattern: RegExp

  /** The replacement string for matched data. */
  replace: string

  /** Optional description of what this rule sanitizes. */
  description?: string

  /** Whether this rule captures file paths that need Windows backslash normalization. */
  normalizeWindowsPaths?: boolean
}

/**
 * Sanitization rules for removing sensitive data from error messages.
 * Order matters: more specific patterns should come before general ones.
 */

// Authentication tokens - must be processed first to avoid partial matches
const jwtTokenRule: SanitizationRule = {
  pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
  replace: '<JWT>',
  description: 'JWT tokens',
}

const databaseUrlRule: SanitizationRule = {
  pattern: /(?:mongodb|postgresql|mysql|redis|postgres|sqlite):\/\/[^\s]+/gi,
  replace: '<DATABASE_URL>',
  description: 'Database connection URLs',
}

const githubTokenRule: SanitizationRule = {
  pattern: /gh[pso]s?_[A-Za-z0-9_]{36,}/g,
  replace: '<GITHUB_TOKEN>',
  description: 'GitHub personal access tokens',
}

const npmTokenRule: SanitizationRule = {
  pattern: /npm_[A-Za-z0-9_]{36,}/g,
  replace: '<NPM_TOKEN>',
  description: 'NPM authentication tokens',
}

const apiKeyRule: SanitizationRule = {
  pattern: /["']?(?:api[_-]?key|apikey|api_secret|api[_-]?token)["']?\s*[=:]\s*["']?[A-Za-z0-9-_]+["']?/gi,
  replace: 'api_key=<REDACTED>',
  description: 'API keys and secrets',
}

const bearerTokenRule: SanitizationRule = {
  pattern: /Bearer\s+[A-Za-z0-9-_]+/gi,
  replace: 'Bearer <TOKEN>',
  description: 'Bearer authentication tokens',
}

// Personal identifiable information
const emailAddressRule: SanitizationRule = {
  pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  replace: '<EMAIL>',
  description: 'Email addresses',
}

// Network and ports - must precede IP/version patterns
const localPortRule: SanitizationRule = {
  pattern: /(localhost|127\.0\.0\.1|0\.0\.0\.0|::1):\d+/gi,
  replace: '$1:<PORT>',
  description: 'Local server ports',
}

// File path normalization - specific patterns before general ones
const nodeModulesPathRule: SanitizationRule = {
  pattern: /(^|[\s])(?:[A-Z]:[\\/]|[\\/]).+?node_modules[\\/]([^\s]+)/gi,
  replace: '$1node_modules/$2',
  description: 'Node modules paths - normalize to relative',
  normalizeWindowsPaths: true,
}

const yarnCachePathRule: SanitizationRule = {
  pattern: /(^|[\s])(?:[A-Z]:[\\/]|[\\/]).+?\.yarn[\\/](?:berry[\\/])?cache[\\/]([^\s]+)/gi,
  replace: '$1yarn-cache/$2',
  description: 'Yarn cache paths',
  normalizeWindowsPaths: true,
}

const pnpmStorePathRule: SanitizationRule = {
  pattern: /(^|[\s])(?:[A-Z]:[\\/]|[\\/]).+?\.(?:pnpm-store|pnpm)[\\/]([^\s]+)/gi,
  replace: '$1pnpm-store/$2',
  description: 'pnpm store paths',
  normalizeWindowsPaths: true,
}

// Shopify-specific URL patterns
const partnersUrlRule: SanitizationRule = {
  pattern: /https?:\/\/partners\.shopify\.com\/\d+\/[^\s]+/gi,
  replace: 'https://partners.shopify.com/<PARTNER_ID>/<PATH>',
  description: 'Partners dashboard URLs',
}

const shopifyDevUrlRule: SanitizationRule = {
  pattern: /https?:\/\/shopify\.dev\/[^\s]+/gi,
  replace: 'https://shopify.dev/<PATH>',
  description: 'Shopify dev documentation URLs',
}

const shopifyApiUrlRule: SanitizationRule = {
  pattern: /https?:\/\/[^/]+\.shopify\.com\/admin\/api\/[\d-]+\/[^\s]+/gi,
  replace: 'https://<DOMAIN>.shopify.com/admin/api/<VERSION>/<RESOURCE>',
  description: 'Shopify API URLs with versions and resources',
}

const genericApiUrlRule: SanitizationRule = {
  pattern: /(https?:\/\/[^/]+)(\/[^\s]*\d{5,}[^\s]*)/gi,
  replace: '$1/<PATH_WITH_ID>',
  description: 'URLs with numeric IDs',
}

// General file path normalization
const systemFilePathRule: SanitizationRule = {
  pattern:
    /(?:[A-Z]:[\\/]|[\\/])(?:Users[\\/][^\\/]+|home[\\/][^\\/]+|var[\\/](?:folders[\\/][^\\/]+[\\/][^\\/]+[\\/][^\\/]+|jenkins[\\/]workspace)|tmp|opt|src|workspace|projects|github[\\/]workspace|bitbucket[\\/]pipelines[\\/]agent|app|private|AppData[\\/](?:Local|Roaming)[\\/][^\\/]+|Windows[\\/]Temp)[\\/][^\s]+/gi,
  replace: '<PATH>',
  description: 'File paths across different operating systems',
}

const absoluteFilePathRule: SanitizationRule = {
  pattern: /(?:[A-Z]:[\\/]|^[\\/])[^\s]*[\\/][^\s]+\.(js|ts|jsx|tsx|mjs|cjs|json)/gi,
  replace: '<PATH>',
  description: 'Remaining absolute file paths',
}

// Shopify-specific identifiers
const shopifyStoreDomainRule: SanitizationRule = {
  pattern: /[\w][\w-]{0,61}\.myshopify\.com/gi,
  replace: '<STORE>.myshopify.com',
  description: 'Shopify store domains',
}

const shopifyAccessTokenRule: SanitizationRule = {
  pattern: /shp[a-z]{2}_[a-f0-9]+/gi,
  replace: '<TOKEN>',
  description: 'Shopify access tokens (shpat_, shpca_, etc.)',
}

const shopifyUserAgentTokenRule: SanitizationRule = {
  pattern: /shpua_[a-z0-9]+/gi,
  replace: '<TOKEN>',
  description: 'Shopify user agent tokens',
}

const shopifyGlobalIdRule: SanitizationRule = {
  pattern: /gid:\/\/shopify\/\w+\/[\w-]+/gi,
  replace: 'gid://shopify/<TYPE>/<ID>',
  description: 'Shopify global IDs',
}

// Timestamps - must come before line:column pattern
const isoTimestampRule: SanitizationRule = {
  pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?/gi,
  replace: '<TIMESTAMP>',
  description: 'ISO 8601 timestamps',
}

const unixTimestampRule: SanitizationRule = {
  pattern: /\b1[5-9]\d{11,12}\b/g,
  replace: '<UNIX_TIMESTAMP>',
  description: 'Unix timestamps (milliseconds)',
}

// Request and trace IDs - must come before UUID pattern
const requestIdRule: SanitizationRule = {
  pattern:
    /(\b(?:request[_-]?id|trace[_-]?id|correlation[_-]?id|x-request-id)[\s:]*)([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:-\d+)?)/gi,
  replace: '$1<REQUEST_ID>',
  description: 'Request/trace IDs with optional numeric suffix',
}

const standaloneRequestIdRule: SanitizationRule = {
  pattern: /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-\d+\b/gi,
  replace: '<REQUEST_ID>',
  description: 'Standalone request IDs (UUID with numeric suffix)',
}

// General identifiers
const uuidRule: SanitizationRule = {
  pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
  replace: '<UUID>',
  description: 'UUID identifiers',
}

// Package and versioning
const npmPackageVersionRule: SanitizationRule = {
  pattern: /@[\w/-]+@\d+\.\d+\.\d+(-[\w.]+)?/gi,
  replace: '@<PACKAGE>@<VERSION>',
  description: 'NPM package versions',
}

const shopifyApiVersionRule: SanitizationRule = {
  pattern: /\/admin\/\d{4}-\d{2}/gi,
  replace: '/admin/<API_VERSION>',
  description: 'Shopify API versions',
}

// Build artifacts
const webpackChunkRule: SanitizationRule = {
  pattern: /([a-z~]+(?:-[a-z~]+){0,10})\.[a-f0-9]{6,8}\.(js|css|mjs)/gi,
  replace: '$1.<HASH>.$2',
  description: 'Webpack chunked file names',
}

const webpackVendorChunkRule: SanitizationRule = {
  pattern: /vendors~[\w-]+\.[a-z0-9]+\.(js|css|mjs)/gi,
  replace: 'vendors~main.<HASH>.$1',
  description: 'Webpack vendor chunks',
}

// Version and location references
const semanticVersionRule: SanitizationRule = {
  pattern: /\bv\d+\.\d+\.\d+(-[\w.]+)?\b/gi,
  replace: '<VERSION>',
  description: 'Semantic version numbers',
}

const lineNumberWithColumnRule: SanitizationRule = {
  pattern: /\bline\s+\d+:\d+/gi,
  replace: 'line <LINE>:<COL>',
  description: 'Line number with column references',
}

const lineNumberRule: SanitizationRule = {
  pattern: /\bline\s+\d+/gi,
  replace: 'line <LINE>',
  description: 'Line number references',
}

const columnNumberRule: SanitizationRule = {
  pattern: /\bcolumn\s+\d+/gi,
  replace: 'column <COL>',
  description: 'Column number references',
}

const lineColumnFormatRule: SanitizationRule = {
  pattern: /\(?\d{1,6}:\d{1,6}\)?/g,
  replace: '(<LINE>:<COL>)',
  description: 'Line:column format in stack traces',
}

export const SANITIZATION_RULES: SanitizationRule[] = [
  // Authentication tokens - process first
  jwtTokenRule,
  databaseUrlRule,
  githubTokenRule,
  npmTokenRule,
  apiKeyRule,
  bearerTokenRule,

  // PII
  emailAddressRule,

  // Timestamps - must come early to avoid line:column mismatches
  isoTimestampRule,
  unixTimestampRule,

  // Network
  localPortRule,

  // File paths - specific before general
  nodeModulesPathRule,
  yarnCachePathRule,
  pnpmStorePathRule,

  // URLs - specific before general
  partnersUrlRule,
  shopifyDevUrlRule,
  shopifyApiUrlRule,
  genericApiUrlRule,

  // General file paths
  systemFilePathRule,
  absoluteFilePathRule,

  // Shopify identifiers
  shopifyStoreDomainRule,
  shopifyAccessTokenRule,
  shopifyUserAgentTokenRule,
  shopifyGlobalIdRule,

  // Request/trace IDs - must come before UUID
  requestIdRule,
  standaloneRequestIdRule,

  // General identifiers
  uuidRule,

  // Package versions
  npmPackageVersionRule,
  shopifyApiVersionRule,

  // Build artifacts
  webpackChunkRule,
  webpackVendorChunkRule,

  // Version and location references - process last
  semanticVersionRule,
  // Must come before lineNumberRule
  lineNumberWithColumnRule,
  lineNumberRule,
  columnNumberRule,
  lineColumnFormatRule,
]
