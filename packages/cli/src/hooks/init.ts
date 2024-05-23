import {Hook} from '@oclif/core'
import {sniffForPath} from '@shopify/cli-kit/node/custom-oclif-loader'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {readFileSync} from 'fs'

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
