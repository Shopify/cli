import {joinPath, cwd} from './path.js'
import {fileExistsSync} from './fs.js'
import {Command, Config} from '@oclif/core'
import {minimatch} from 'minimatch'
import glob from 'fast-glob'
import yargs from 'yargs'
import {Options} from '@oclif/core/lib/interfaces/plugin.js'
import fs from 'fs'
import util from 'util'

export class ShopifyConfig extends Config {
  constructor(options: Options) {
    super(options)
    // eslint-disable-next-line dot-notation
    this['determinePriority'] = (commands: Command.Loadable[]) => {
      const isHydrogenCommand = commands.some((command) => command.id.startsWith('hydrogen:'))
      if (!isHydrogenCommand) return this.privateDeterminePriority(commands)

      const hydrogenPlugin = commands.find((command) => command.pluginAlias === '@shopify/cli-hydrogen')
      const bestChoice = hydrogenPlugin ?? this.privateDeterminePriority(commands)
      return bestChoice
    }
  }

  async loadCorePlugins(): Promise<void> {
    // Find potential plugins based on sniffing the `--path` argument
    const matches: [string, string[]][] = []
    const manualPath = await sniffForPath()
    if (manualPath) {
      matches.push(...(await listDependencies(manualPath, '@shopify/*')))
    }

    // Find potential plugins from the working directory
    const thisPath = cwd()
    matches.push(...(await listDependencies(thisPath, '@shopify/*')))

    // Load as usual
    await super.loadCorePlugins()

    // Load gathered potential plugins
    for (const [root, names] of matches) {
      // eslint-disable-next-line no-await-in-loop
      await this.loadPlugins(root, 'custom', names)
    }
  }

  privateDeterminePriority(commands: Command.Loadable[]): Command.Loadable | undefined {
    const oclifPlugins = this.pjson.oclif?.plugins ?? []
    const commandPlugins = commands.sort((aCommand, bCommand) => {
      // eslint-disable-next-line no-restricted-syntax
      const pluginAliasA = aCommand.pluginAlias ?? 'A-Cannot-Find-This'
      // eslint-disable-next-line no-restricted-syntax
      const pluginAliasB = bCommand.pluginAlias ?? 'B-Cannot-Find-This'
      const aIndex = oclifPlugins.indexOf(pluginAliasA)
      const bIndex = oclifPlugins.indexOf(pluginAliasB)
      // When both plugin types are 'core' plugins sort based on index
      if (aCommand.pluginType === 'core' && bCommand.pluginType === 'core') {
        // If b appears first in the pjson.plugins sort it first
        return aIndex - bIndex
      }

      // if b is a core plugin and a is not sort b first
      if (bCommand.pluginType === 'core' && aCommand.pluginType !== 'core') {
        return 1
      }

      // if a is a core plugin and b is not sort a first
      if (aCommand.pluginType === 'core' && bCommand.pluginType !== 'core') {
        return -1
      }

      // if a is a jit plugin and b is not sort b first
      if (aCommand.pluginType === 'jit' && bCommand.pluginType !== 'jit') {
        return 1
      }

      // if b is a jit plugin and a is not sort a first
      if (bCommand.pluginType === 'jit' && aCommand.pluginType !== 'jit') {
        return -1
      }

      // neither plugin is core, so do not change the order
      return 0
    })
    return commandPlugins[0]
  }
}

const readFileAsync = util.promisify(fs.readFile)

/**
 * Lists all the dependencies from a single package.json that meet some wildcard.
 *
 * @param packageJsonPath - Path to package.json file.
 * @param wildcard - Wildcard pattern as per `minimatch`.
 */
async function processPackageJson(packageJsonPath: string, wildcard: string): Promise<[string, string[]][]> {
  const data = await readFileAsync(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(data)
  const dependencies = Object.keys(packageJson.dependencies || {})
  const devDependencies = Object.keys(packageJson.devDependencies || {})

  const allDependencies = dependencies.concat(devDependencies)

  const matchingDependencies = allDependencies.filter((dependency) => minimatch(dependency, wildcard))
  return [[packageJsonPath, matchingDependencies]]
}

/**
 * Lists all the dependencies within a project path that match some wildcard. Checks workspaces too.
 *
 * @param projectPath - Where to search for dependencies.
 * @param wildcard - Wildcard pattern as per `minimatch`.
 */
async function listDependencies(projectPath: string, wildcard: string): Promise<[string, string[]][]> {
  const packageJsonPath = `${projectPath}/package.json`
  if (!fileExistsSync(packageJsonPath)) return []
  const data = await readFileAsync(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(data)
  const workspaces = packageJson.workspaces || []

  const res = await processPackageJson(packageJsonPath, wildcard)
  if (workspaces.length > 0) {
    const packageJsonPromises = []

    for (const workspaceGlob of workspaces) {
      const workspaceGlobPath = joinPath(projectPath, workspaceGlob, 'package.json')
      const packageJsonFiles = glob.sync(workspaceGlobPath)

      for (const packageJsonPath of packageJsonFiles) {
        packageJsonPromises.push(processPackageJson(packageJsonPath, wildcard))
      }
    }

    const fromWorkspaces = await Promise.all(packageJsonPromises)
    for (const fromSpace of fromWorkspaces) {
      res.push(...fromSpace)
    }
  }
  return res
}
/**
 * Tries to get the value of the `--path` argument, if provided.
 *
 */
async function sniffForPath(): Promise<string | undefined> {
  const parsed = yargs(process.argv)
    .options({path: {type: 'string'}})
    .help(false)
    .version(false)
    .skipValidation('path')
    .parseSync()
  return parsed.path
}
