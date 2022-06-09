import {file, path, error} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

export async function cliVersion(): Promise<string> {
  const cliPackageJsonpath =
    (await path.findUp('@shopify/cli/package.json', {
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      type: 'file',
    })) ??
    (await path.findUp('packages/cli-main/package.json', {
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      type: 'file',
    }))
  if (!cliPackageJsonpath) {
    throw new error.Bug("Couldn't determine the version of the CLI")
  }
  const packageJson = JSON.parse(await file.read(cliPackageJsonpath))
  return packageJson.version
}
