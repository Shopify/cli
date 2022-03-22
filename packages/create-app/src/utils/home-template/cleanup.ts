import {file, path} from '@shopify/cli-kit'
import {configurationFileNames} from '../../constants'

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

  const templatePaths = await path.glob(
    [
      path.join(homeOutputDirectory, '**', '_template'),
      path.join(homeOutputDirectory, '**', configurationFileNames.homeTemplate),
    ],
    {
      onlyFiles: false,
      onlyDirectories: false,
      ignore: ['**/node_modules/**'],
    },
  )

  const pathsToDelete = [...gitPaths, ...templatePaths]

  return Promise.all(pathsToDelete.map((path) => file.rmdir(path, {force: true}))).then(() => {})
}
