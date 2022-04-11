import {file, path} from '@shopify/cli-kit'

export default async function cleanup(homeOutputDirectory: string) {
  const gitPaths = await path.glob(
    [
      path.join(homeOutputDirectory, '**', '.git'),
      path.join(homeOutputDirectory, '**', '.github'),
      path.join(homeOutputDirectory, '**', '.gitmodules'),
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
