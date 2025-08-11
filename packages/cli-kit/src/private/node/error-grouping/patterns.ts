/**
 * Rule for sanitizing sensitive data from error messages.
 */
export interface SanitizationRule {
  /** The regex pattern to match sensitive data. */
  pattern: RegExp

  /** The replacement string for matched data. */
  replace: string

  /** Optional description of what this rule sanitizes. */
  description?: string
}

/**
 * Sanitization rules for removing sensitive data from error messages.
 * Order matters: more specific patterns should come before general ones.
 */
// JWT must be processed first to avoid partial matches by other patterns
const jwtTokenRules: SanitizationRule = {
  pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
  replace: '<JWT>',
  description: 'JWT tokens',
}

const databaseUrlRules: SanitizationRule = {
  pattern: /(?:mongodb|postgresql|mysql|redis|postgres|sqlite):\/\/[^\s]+/gi,
  replace: '<DATABASE_URL>',
  description: 'Database connection URLs',
}

const githubTokenRules: SanitizationRule = {
  pattern: /gh[pso]s?_[A-Za-z0-9_]{36,}/g,
  replace: '<GITHUB_TOKEN>',
  description: 'GitHub personal access tokens',
}

export const SANITIZATION_RULES: SanitizationRule[] = [
  jwtTokenRules,
  databaseUrlRules,
  githubTokenRules,

  // NPM tokens
  {
    pattern: /npm_[A-Za-z0-9_]{36,}/g,
    replace: '<NPM_TOKEN>',
    description: 'NPM authentication tokens',
  },

  // API keys - various formats
  {
    pattern: /(?:api[_-]?key|apikey|api_secret|api[_-]?token)[=:]\s*["']?[A-Za-z0-9-_]+["']?/gi,
    replace: 'api_key=<REDACTED>',
    description: 'API keys and secrets',
  },

  // Bearer tokens
  {
    pattern: /Bearer\s+[A-Za-z0-9-_]+/gi,
    replace: 'Bearer <TOKEN>',
    description: 'Bearer authentication tokens',
  },

  // Email addresses - before @ symbols in other patterns
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replace: '<EMAIL>',
    description: 'Email addresses',
  },

  // Ports must precede IP/version patterns to avoid conflicts
  {
    pattern: /(localhost|127\.0\.0\.1|0\.0\.0\.0|::1):\d+/gi,
    replace: '$1:<PORT>',
    description: 'Local server ports',
  },

  // File path normalization - specific patterns before general ones
  {
    pattern: /(?:[A-Z]:[\\/]|[\\/])?.*node_modules[\\/]([^\s]+)/gi,
    replace: 'node_modules/$1',
    description: 'Node modules paths - normalize to relative',
  },
  // Yarn cache paths
  {
    pattern: /(?:[A-Z]:[\\/]|[\\/])?.*\.yarn[\\/](?:berry[\\/])?cache[\\/]([^\s]+)/gi,
    replace: 'yarn-cache/$1',
    description: 'Yarn cache paths',
  },
  // pnpm store paths
  {
    pattern: /(?:[A-Z]:[\\/]|[\\/])?.*\.(?:pnpm-store|pnpm)[\\/]([^\s]+)/gi,
    replace: 'pnpm-store/$1',
    description: 'pnpm store paths',
  },
  // All other file paths - normalize aggressively (but don't touch already normalized paths)
  {
    pattern:
      /(?:[A-Z]:[\\/]|[\\/])(?:Users[\\/][^\\/]+|home[\\/][^\\/]+|var[\\/](?:folders[\\/][^\\/]+[\\/][^\\/]+[\\/][^\\/]+|jenkins[\\/]workspace)|tmp|opt|src|workspace|projects|github[\\/]workspace|bitbucket[\\/]pipelines[\\/]agent|app|private|AppData[\\/](?:Local|Roaming)[\\/][^\\/]+|Windows[\\/]Temp)[\\/][^\s]+/gi,
    replace: '<PATH>',
    description: 'File paths across different operating systems',
  },
  // Simpler catch-all for remaining absolute paths (but not already normalized paths)
  {
    pattern: /(?:[A-Z]:[\\/]|^[\\/])[^\s]*[\\/][^\s]+\.(js|ts|jsx|tsx|mjs|cjs|json)/gi,
    replace: '<PATH>',
    description: 'Remaining absolute file paths',
  },

  {
    pattern: /[\w][\w-]{0,61}\.myshopify\.com/gi,
    replace: '<STORE>.myshopify.com',
    description: 'Shopify store domains',
  },

  // Shopify tokens must be processed before UUID patterns
  {
    pattern: /shp[a-z]{2}_[a-f0-9]+/gi,
    replace: '<TOKEN>',
    description: 'Shopify access tokens (shpat_, shpca_, etc.)',
  },
  {
    pattern: /shpua_[a-z0-9]+/gi,
    replace: '<TOKEN>',
    description: 'Shopify user agent tokens',
  },

  {
    pattern: /gid:\/\/shopify\/\w+\/[\w-]+/gi,
    replace: 'gid://shopify/<TYPE>/<ID>',
    description: 'Shopify global IDs',
  },

  {
    pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
    replace: '<UUID>',
    description: 'UUID identifiers',
  },

  {
    pattern: /@[\w/-]+@\d+\.\d+\.\d+(-[\w.]+)?/gi,
    replace: '@<PACKAGE>@<VERSION>',
    description: 'NPM package versions',
  },

  {
    pattern: /\/admin\/\d{4}-\d{2}/gi,
    replace: '/admin/<API_VERSION>',
    description: 'Shopify API versions',
  },

  {
    pattern: /([a-z~]+(?:-[a-z~]+){0,10})\.[a-f0-9]{6,8}\.(js|css|mjs)/gi,
    replace: '$1.<HASH>.$2',
    description: 'Webpack chunked file names',
  },
  {
    pattern: /vendors~[\w-]+\.[a-z0-9]+\.(js|css|mjs)/gi,
    replace: 'vendors~main.<HASH>.$1',
    description: 'Webpack vendor chunks',
  },

  // Version patterns must follow port patterns to avoid conflicts
  {
    pattern: /\bv\d+\.\d+\.\d+(-[\w.]+)?\b/gi,
    replace: '<VERSION>',
    description: 'Semantic version numbers',
  },

  {
    pattern: /\bline\s+\d+/gi,
    replace: 'line <LINE>',
    description: 'Line number references',
  },

  {
    pattern: /\bcolumn\s+\d+/gi,
    replace: 'column <COL>',
    description: 'Column number references',
  },

  {
    pattern: /\(?\d{1,6}:\d{1,6}\)?/g,
    replace: '(<LINE>:<COL>)',
    description: 'Line:column format in stack traces',
  },
]
