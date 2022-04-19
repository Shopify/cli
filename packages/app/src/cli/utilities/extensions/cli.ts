import {getBinaryPathOrDownload} from './binary'
import {useExtensionsCLISources} from '../../environment'
import {system} from '@shopify/cli-kit'

/**
 * This function runs the extensions' CLI and has support for running
 * it through its source code when the SHOPIFY_USE_EXTENSIONS_CLI_SOURCES=1 variable
 * is set.
 * @param args {string[]} Arguments to pass to the CLI
 * @param options {system.ExecOptions} Options to configure the process execution.
 */
export async function runExtensionsCLI(args: string[], options: system.ExecOptions = {}) {
  if (useExtensionsCLISources()) {
    const projectDirectory = await system.captureOutput('/opt/dev/bin/dev', ['project-path', 'shopify-cli-extensions'])
    await system.exec('make', ['run', ...args], {...options, cwd: projectDirectory})
  } else {
    const binaryPath = await getBinaryPathOrDownload()
    await system.exec(binaryPath, [...args], options)
  }
}
