import {rmdir, glob, fileExistsSync, unlinkFile} from '@shopify/cli-kit/node/fs'
import {lockfilesByManager, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {joinPath} from '@shopify/cli-kit/node/path'

export default async function cleanup(webOutputDirectory: string, packageManager: PackageManager) {
  const gitPaths = await glob(
    [
      joinPath(webOutputDirectory, '**', '.git'),
      joinPath(webOutputDirectory, '**', '.github'),
      joinPath(webOutputDirectory, '**', '.gitmodules'),
      joinPath(webOutputDirectory, '**', '.cli-liquid-bypass'),
      joinPath(webOutputDirectory, 'LICENSE*'),
      joinPath(webOutputDirectory, '**', 'frontend/LICENSE*'),
      joinPath(webOutputDirectory, 'package.json.cli2'),
    ],
    {
      dot: true,
      onlyFiles: false,
      onlyDirectories: false,
      ignore: ['**/node_modules/**'],
    },
  )

  const unusedLockfiles =
    packageManager === 'unknown'
      ? []
      : Object.entries(lockfilesByManager).reduce<string[]>((acc, [manager, lockfile]) => {
          if (manager !== 'unknown' && manager !== packageManager) {
            const path = joinPath(webOutputDirectory, lockfile)
            if (fileExistsSync(path)) {
              acc.push(path)
            }
          }

          return acc
        }, [])

  return Promise.all([
    ...gitPaths.map((path) => rmdir(path, {force: true})),
    ...unusedLockfiles.map((path) => unlinkFile(path)),
  ])
}
