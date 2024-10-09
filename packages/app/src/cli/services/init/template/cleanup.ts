import {rmdir, glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

export default async function cleanup(webOutputDirectory: string) {
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

  return Promise.all(gitPaths.map((path) => rmdir(path, {force: true}))).then(() => {})
}
