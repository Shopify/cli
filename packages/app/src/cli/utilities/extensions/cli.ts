import {getBinaryPathOrDownload} from './binary'
import {useExtensionsCLISources} from '../../environment'
import {environment, error, path, system} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

let building = false
let built = false

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
export async function runGoExtensionsCLI(args: string[], options: system.WritableExecOptions = {}) {
  const stdout = options.stdout || {write: () => {}}
  if (useExtensionsCLISources()) {
    const projectDirectory = path.join(
      environment.local.homeDirectory(),
      'src/github.com/shopify/shopify-cli-extensions',
    )
    stdout.write(`Using extensions CLI from ${projectDirectory}`)
    try {
      if (building) {
        // eslint-disable-next-line no-unmodified-loop-condition
        while (!built) {
          // eslint-disable-next-line no-await-in-loop
          await system.sleep(1)
        }
      } else {
        building = true
        stdout.write('Building extensions CLI...')
        await system.exec('make', ['build'], {
          ...options,
          stdout: undefined,
          stderr: undefined,
          cwd: projectDirectory,
        })
        built = true
        stdout.write('Built extensions CLI successfully!')
      }
      await system.exec(path.join(projectDirectory, 'shopify-extensions'), args, options)
    } catch {
      throw new error.AbortSilent()
    }
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
