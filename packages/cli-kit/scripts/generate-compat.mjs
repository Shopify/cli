/**
 * Generates backward-compatible re-export files at old import paths.
 * These allow external consumers (e.g. @shopify/cli-hydrogen) to keep
 * using @shopify/cli-kit/node/* paths while we migrate to the new structure.
 *
 * Run this after building to populate dist/compat/.
 */

import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'fs'
import {dirname, join} from 'path'

const DIST = 'dist'
const COMPAT = join(DIST, 'compat')

const mapping = {
  // Identity
  'node/session': 'identity/session',
  'node/session-prompt': 'identity/session-prompt',
  // Admin
  'node/api/admin': 'admin/api',
  'node/api/rest-api-throttler': 'admin/rest-api-throttler',
  // Partners
  'node/api/partners': 'partners/api',
  // App Management
  'node/api/app-management': 'app-management/api',
  // App Dev
  'node/api/app-dev': 'app-dev/api',
  // Business Platform
  'node/api/business-platform': 'business-platform/api',
  // Functions
  'node/api/functions': 'functions/api',
  // Webhooks
  'node/api/webhooks': 'webhooks/api',
  // Themes
  'node/themes/api': 'themes/api',
  'node/themes/conf': 'themes/conf',
  'node/themes/factories': 'themes/factories',
  'node/themes/theme-manager': 'themes/theme-manager',
  'node/themes/types': 'themes/types',
  'node/themes/urls': 'themes/urls',
  'node/themes/utils': 'themes/utils',
  // Shared node
  'node/abort': 'shared/node/abort',
  'node/analytics': 'shared/node/analytics',
  'node/api/graphql': 'shared/node/api/graphql',
  'node/api/utilities': 'shared/node/api/utilities',
  'node/archiver': 'shared/node/archiver',
  'node/base-command': 'shared/node/base-command',
  'node/cli': 'shared/node/cli',
  'node/cli-launcher': 'shared/node/cli-launcher',
  'node/colors': 'shared/node/colors',
  'node/context/fqdn': 'shared/node/context/fqdn',
  'node/context/local': 'shared/node/context/local',
  'node/context/utilities': 'shared/node/context/utilities',
  'node/crypto': 'shared/node/crypto',
  'node/custom-oclif-loader': 'shared/node/custom-oclif-loader',
  'node/dot-env': 'shared/node/dot-env',
  'node/environment': 'shared/node/environment',
  'node/environments': 'shared/node/environments',
  'node/error': 'shared/node/error',
  'node/error-handler': 'shared/node/error-handler',
  'node/figures': 'shared/node/figures',
  'node/framework': 'shared/node/framework',
  'node/fs': 'shared/node/fs',
  'node/git': 'shared/node/git',
  'node/github': 'shared/node/github',
  'node/global-context': 'shared/node/global-context',
  'node/hidden-folder': 'shared/node/hidden-folder',
  'node/hooks/deprecations': 'shared/node/hooks/deprecations',
  'node/hooks/postrun': 'shared/node/hooks/postrun',
  'node/hooks/prerun': 'shared/node/hooks/prerun',
  'node/hrtime': 'shared/node/hrtime',
  'node/http': 'shared/node/http',
  'node/import-extractor': 'shared/node/import-extractor',
  'node/ink': 'shared/node/ink',
  'node/is-global': 'shared/node/is-global',
  'node/json-schema': 'shared/node/json-schema',
  'node/liquid': 'shared/node/liquid',
  'node/local-storage': 'shared/node/local-storage',
  'node/logs': 'shared/node/logs',
  'node/metadata': 'shared/node/metadata',
  'node/mimes': 'shared/node/mimes',
  'node/monorail': 'shared/node/monorail',
  'node/multiple-installation-warning': 'shared/node/multiple-installation-warning',
  'node/node-package-manager': 'shared/node/node-package-manager',
  'node/notifications-system': 'shared/node/notifications-system',
  'node/os': 'shared/node/os',
  'node/output': 'shared/node/output',
  'node/path': 'shared/node/path',
  'node/plugins': 'shared/node/plugins',
  'node/plugins/tunnel': 'shared/node/plugins/tunnel',
  'node/promises': 'shared/node/promises',
  'node/result': 'shared/node/result',
  'node/schema': 'shared/node/schema',
  'node/serial-batch-processor': 'shared/node/serial-batch-processor',
  'node/system': 'shared/node/system',
  'node/tcp': 'shared/node/tcp',
  'node/testing/output': 'shared/node/testing/output',
  'node/testing/test-with-temp-dir': 'shared/node/testing/test-with-temp-dir',
  'node/testing/ui': 'shared/node/testing/ui',
  'node/toml': 'shared/node/toml',
  'node/tree-kill': 'shared/node/tree-kill',
  'node/ui': 'shared/node/ui',
  'node/ui/components': 'shared/node/ui/components',
  'node/ui/hooks': 'shared/node/ui/hooks',
  'node/upgrade': 'shared/node/upgrade',
  'node/version': 'shared/node/version',
  'node/vscode': 'shared/node/vscode',
  'node/doctor/framework': 'shared/node/doctor/framework',
  'node/doctor/reporter': 'shared/node/doctor/reporter',
  'node/doctor/types': 'shared/node/doctor/types',
  // Shared common
  'common/array': 'shared/common/array',
  'common/collection': 'shared/common/collection',
  'common/function': 'shared/common/function',
  'common/json': 'shared/common/json',
  'common/lang': 'shared/common/lang',
  'common/object': 'shared/common/object',
  'common/retry': 'shared/common/retry',
  'common/string': 'shared/common/string',
  'common/url': 'shared/common/url',
  'common/version': 'shared/common/version',
  'common/ts/deep-required': 'shared/common/ts/deep-required',
  'common/ts/json-narrowing': 'shared/common/ts/json-narrowing',
  'common/ts/pick-by-prefix': 'shared/common/ts/pick-by-prefix',
}

let count = 0
for (const [oldPath, newPath] of Object.entries(mapping)) {
  const compatFile = join(COMPAT, `${oldPath}.js`)
  const compatDir = dirname(compatFile)

  // Compute relative path from compat location to actual dist location
  const depth = oldPath.split('/').length
  const prefix = '../'.repeat(depth)
  const target = `${prefix}${newPath}.js`

  // Check if the target module has a default export
  const targetFile = join(DIST, `${newPath}.js`)
  let hasDefault = false
  if (existsSync(targetFile)) {
    const content = readFileSync(targetFile, 'utf8')
    hasDefault = /export\s*\{[^}]*\bdefault\b|export\s+default\b/.test(content)
  }

  mkdirSync(compatDir, {recursive: true})
  let jsContent = `export * from '${target}';\n`
  let dtsContent = `export * from '${target.replace('.js', '')}';\n`
  if (hasDefault) {
    jsContent += `export { default } from '${target}';\n`
    dtsContent += `export { default } from '${target.replace('.js', '')}';\n`
  }

  writeFileSync(compatFile, jsContent)
  writeFileSync(join(COMPAT, `${oldPath}.d.ts`), dtsContent)

  count++
}

console.log(`Generated ${count} compat re-export files in dist/compat/`)
