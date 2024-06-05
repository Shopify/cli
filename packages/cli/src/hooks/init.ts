import {Hook} from '@oclif/core'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, sniffForPath} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {readFileSync} from 'fs'

/**
 * When running a Hydrogen command (except hydrogen:init), check if the current directory is a Hydrogen project.
 * If it's not, show a warning and exit. We need to do this here because some hydrogen commands depend on some peerDependencies
 * that are loaded dynamically from the project's package.json.
 *
 * To check if the project is a Hydrogen one, we look for the presence of the \@shopify/hydrogen dependency in the project's package.json.
 *
 * @param options - The options passed to the hook.
 */
const hook: Hook<'init'> = async (options) => {
  const isHydrogenCommand = options.id?.startsWith('hydrogen:') ?? false
  const isHydrogenInitCommand = options.id?.startsWith('hydrogen:init') ?? false
  if (isHydrogenCommand && !isHydrogenInitCommand) {
    const path = sniffForPath() ?? cwd()
    const packageJsonPath = joinPath(path, 'package.json')
    if (!fileExistsSync(packageJsonPath)) showWarningAndExit()
    const packageJsonContent = readFileSync(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)
    const packageJsonDependencies = packageJson.dependencies as {[key: string]: string}
    const dependenciesIncludeHydrogen = packageJsonDependencies['@shopify/hydrogen'] !== undefined
    if (!dependenciesIncludeHydrogen) showWarningAndExit()
  }
}

function showWarningAndExit() {
  renderWarning({
    body: [
      `Looks like you're trying to run a Hydrogen command outside of a Hydrogen project.`,
      'Run',
      {command: 'shopify hydrogen init'},
      'to create a new Hydrogen project.',
    ],
  })
  process.exit()
}

export default hook
