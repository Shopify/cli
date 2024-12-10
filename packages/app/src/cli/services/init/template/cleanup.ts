import {rmdir, glob, fileExistsSync, unlinkFile} from '@shopify/cli-kit/node/fs'
import {Lockfile, lockfilesByManager, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
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

  const gitPathPromises = gitPaths.map((path) => rmdir(path, {force: true}))

  const lockfilePromises =
    packageManager === 'unknown'
      ? []
      : Object.entries(lockfilesByManager)
          .filter(([manager, lockfile]) => manager !== packageManager && lockfile)
          .map(([_, lockfile]) => {
            const path = joinPath(webOutputDirectory, lockfile as Lockfile)
            if (fileExistsSync(path)) return unlinkFile(path)
          }, [])

  return Promise.all([...gitPathPromises, ...lockfilePromises])
}
