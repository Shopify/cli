import {getBinaryPathOrDownload} from './binary'
import {useExtensionsCLISources} from '../../environment'
import {system, error, path} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

const NodeExtensionsCLINotFoundError = () => {
  return new error.Bug(`Couldn't find the shopify-cli-extensions Node binary`)
}
/**
 * This function runs the extensions' CLI and has support for running
 * it through its source code when the SHOPIFY_USE_EXTENSIONS_CLI_SOURCES=1 variable
 * is set.
 * @param args {string[]} Arguments to pass to the CLI
 * @param options {system.ExecOptions} Options to configure the process execution.
 */
export async function runGoExtensionsCLI(args: string[], options: system.ExecOptions = {}) {
  if (useExtensionsCLISources()) {
    const projectDirectory = await system.captureOutput('/opt/dev/bin/dev', ['project-path', 'shopify-cli-extensions'])
    await system.exec('make', ['run', ...args], {...options, cwd: projectDirectory})
  } else {
    const binaryPath = await getBinaryPathOrDownload()
    await system.exec(binaryPath, [...args], options)
  }
}

/**
 * The extensions' CLI is comprised by a Go and Node executable. The latter is distributed
 * as an NPM package, @shopify/shopify-cli-extensions, which is dependency of @shopify/app.
 * This method looks up the binary under node_modules/.bin and returns its path.
 * @returns {Promise<string>} A promise that resolves with the path to the Node executable.
 */
export async function nodeExtensionsCLIPath(): Promise<string> {
  const cwd = path.dirname(fileURLToPath(import.meta.url))
  const executablePath = await path.findUp('node_modules/.bin/shopify-cli-extensions', {type: 'file', cwd})
  if (!executablePath) {
    throw NodeExtensionsCLINotFoundError()
  }
  return executablePath
}
