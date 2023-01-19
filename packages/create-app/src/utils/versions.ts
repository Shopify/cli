import {error} from '@shopify/cli-kit'
import {readFile, findPathUp} from '@shopify/cli-kit/node/fs'
import {dirname} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'url'

export async function cliVersion(): Promise<string> {
  const cliPackageJsonpath =
    (await findPathUp('@shopify/cli/package.json', {
      cwd: dirname(fileURLToPath(import.meta.url)),
      type: 'file',
      allowSymlinks: true,
    })) ??
    (await findPathUp('packages/cli/package.json', {
      cwd: dirname(fileURLToPath(import.meta.url)),
      type: 'file',
    }))
  if (!cliPackageJsonpath) {
    throw new error.Bug("Couldn't determine the version of the CLI")
  }
  const packageJson = JSON.parse(await readFile(cliPackageJsonpath))
  return packageJson.version
}
