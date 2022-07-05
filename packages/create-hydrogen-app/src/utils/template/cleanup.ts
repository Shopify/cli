import {file, path} from '@shopify/cli-kit'

export default async function cleanup(webOutputDirectory: string) {
  const gitPaths = await path.glob(
    [
      path.join(webOutputDirectory, '**', '.git'),
      path.join(webOutputDirectory, '**', '.github'),
      path.join(webOutputDirectory, '**', '.gitmodules'),
      path.join(webOutputDirectory, 'LICENSE*'),
      path.join(webOutputDirectory, '**', 'frontend/LICENSE*'),
      path.join(webOutputDirectory, 'package.json.cli2'),
    ],
    {
      dot: true,
      onlyFiles: false,
      onlyDirectories: false,
      ignore: ['**/node_modules/**'],
    },
  )

  return Promise.all(gitPaths.map((path) => file.rmdir(path, {force: true}))).then(() => {})
}
