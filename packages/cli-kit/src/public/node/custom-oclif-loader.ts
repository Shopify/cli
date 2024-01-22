import {joinPath, cwd} from './path.js'
import {fileExistsSync} from './fs.js'
import {Config} from '@oclif/core'
import {minimatch} from 'minimatch'
import glob from 'fast-glob'
import yargs from 'yargs'
import fs from 'fs'
import util from 'util'

export class ShopifyConfig extends Config {
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
