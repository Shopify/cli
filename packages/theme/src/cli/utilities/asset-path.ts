import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

export async function resolveAssetPath(...subpaths: string[]) {
  if (process.env.SHOPIFY_UNIT_TEST) {
    return joinPath(__dirname, '..', '..', '..', ...subpaths)
  }

  const cliRootPath = dirname(require.resolve('@shopify/cli/package.json'))
  return joinPath(cliRootPath, 'dist', 'assets', ...subpaths)
}
