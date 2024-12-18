export const configurationFileName = 'shopify.theme.toml'

/**
 * This is a more performant date time format that allows us to circumvent the locale lookup
 * performed in toLocaleTimeString.
 * Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString
 */
export const timestampDateFormat = new Intl.DateTimeFormat(undefined, {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * Files ignored by default in the theme development server.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  '**/.git',
  '**/.vscode',
  '**/.hg',
  '**/.bzr',
  '**/.svn',
  '**/_darcs',
  '**/CVS',
  '**/*.sublime-(project|workspace)',
  '**/.DS_Store',
  '**/.sass-cache',
  '**/Thumbs.db',
  '**/desktop.ini',
  '**/config.yml',
  '**/node_modules/',
  '.prettierrc.json',
]

export const MAX_GRAPHQL_THEME_FILES = 50
