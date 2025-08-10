import type {SanitizationRule} from './types.js'

/**
 * Sanitization rules for removing sensitive data from error messages.
 * Order matters: more specific patterns should come before general ones.
 */
export const SANITIZATION_RULES: SanitizationRule[] = [
  // CRITICAL: JWT tokens - MUST come first to avoid partial matches
  {
    pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
    replace: '<JWT>',
    description: 'JWT tokens',
  },

  // Database URLs - before general URLs
  {
    pattern: /(?:mongodb|postgresql|mysql|redis|postgres|sqlite):\/\/[^\s]+/gi,
    replace: '<DATABASE_URL>',
    description: 'Database connection URLs',
  },

  // GitHub tokens - before general tokens (includes ghps_ pattern)
  {
    pattern: /gh[pso]s?_[A-Za-z0-9_]{36,}/g,
    replace: '<GITHUB_TOKEN>',
    description: 'GitHub personal access tokens',
  },

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

  // 1. Ports (localhost:*) - MUST come first before any IP/version patterns
  {
    pattern: /(localhost|127\.0\.0\.1|0\.0\.0\.0|::1):\d+/gi,
    replace: '$1:<PORT>',
    description: 'Local server ports',
  },

  // 2. File paths - AGGRESSIVE normalization across all OS
  // IMPORTANT: More specific patterns must come first!

  // node_modules paths - extract only the part after node_modules/
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

  // 3. Store names (*.myshopify.com)
  {
    pattern: /[\w][\w-]{0,61}\.myshopify\.com/gi,
    replace: '<STORE>.myshopify.com',
    description: 'Shopify store domains',
  },

  // 4. Shopify tokens (shpat_*, shpua_*, etc.) - Must come before UUIDs
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

  // 5. GIDs (gid://shopify/*)
  {
    pattern: /gid:\/\/shopify\/\w+\/[\w-]+/gi,
    replace: 'gid://shopify/<TYPE>/<ID>',
    description: 'Shopify global IDs',
  },

  // 6. UUIDs
  {
    pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
    replace: '<UUID>',
    description: 'UUID identifiers',
  },

  // 7. Package versions (@package@version)
  {
    pattern: /@[\w/-]+@\d+\.\d+\.\d+(-[\w.]+)?/gi,
    replace: '@<PACKAGE>@<VERSION>',
    description: 'NPM package versions',
  },

  // 8. API versions (/admin/YYYY-MM)
  {
    pattern: /\/admin\/\d{4}-\d{2}/gi,
    replace: '/admin/<API_VERSION>',
    description: 'Shopify API versions',
  },

  // 9. Webpack chunks
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

  // 10. Version numbers (v1.2.3) - Must come after ports
  {
    pattern: /\bv\d+\.\d+\.\d+(-[\w.]+)?\b/gi,
    replace: '<VERSION>',
    description: 'Semantic version numbers',
  },

  // 11. Line numbers
  {
    pattern: /\bline\s+\d+/gi,
    replace: 'line <LINE>',
    description: 'Line number references',
  },

  // 12. Column numbers
  {
    pattern: /\bcolumn\s+\d+/gi,
    replace: 'column <COL>',
    description: 'Column number references',
  },

  // 13. Line:Column format
  {
    pattern: /\(?\d{1,6}:\d{1,6}\)?/g,
    replace: '(<LINE>:<COL>)',
    description: 'Line:column format in stack traces',
  },
]

/**
 * Get sanitization rules by category.
 *
 * @param category - The category of rules to retrieve.
 * @returns An array of sanitization rules for the specified category.
 */
function getRulesByCategory(
  category: 'paths' | 'tokens' | 'identifiers' | 'versions' | 'locations',
): SanitizationRule[] {
  switch (category) {
    case 'paths':
      return SANITIZATION_RULES.filter((rule) =>
        Boolean(rule.description?.includes('path') ?? rule.description?.includes('File')),
      )
    case 'tokens':
      return SANITIZATION_RULES.filter((rule) => Boolean(rule.description?.includes('token')))
    case 'identifiers':
      return SANITIZATION_RULES.filter((rule) =>
        Boolean(
          rule.description?.includes('UUID') ??
            rule.description?.includes('GID') ??
            rule.description?.includes('store'),
        ),
      )
    case 'versions':
      return SANITIZATION_RULES.filter((rule) =>
        Boolean(rule.description?.includes('version') ?? rule.description?.includes('API')),
      )
    case 'locations':
      return SANITIZATION_RULES.filter((rule) =>
        Boolean(rule.description?.includes('Line') ?? rule.description?.includes('Column')),
      )
    default:
      return SANITIZATION_RULES
  }
}
