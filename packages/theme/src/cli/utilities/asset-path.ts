import {findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'

export async function resolveAssetPath(...subpaths: string[]) {
  const rootPkgJon = await findPathUp('package.json', {
    cwd: fileURLToPath(import.meta.url),
    type: 'file',
  })

  if (!rootPkgJon) {
    throw new Error('Failed to find CLI root path')
  }

  return rootPkgJon.endsWith('/packages/theme/package.json')
    ? joinPath(dirname(rootPkgJon), 'assets', ...subpaths)
    : joinPath(dirname(rootPkgJon), 'dist', 'assets', ...subpaths)
}
