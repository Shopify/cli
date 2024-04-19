import {
  addNPMDependencies,
  findUpAndReadPackageJson,
  checkForNewVersion,
  DependencyType,
  getPackageManager,
  PackageJson,
  usesWorkspaces,
} from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {dirname, joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {findPathUp, glob} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputInfo, outputSuccess, outputToken, outputWarn} from '@shopify/cli-kit/node/output'

type HomebrewPackageName = 'shopify-cli' | 'shopify-cli@3'

// Canonical list of oclif plugins that should be installed globally
const globalPlugins = ['@shopify/theme']

interface UpgradeOptions {
  env: NodeJS.ProcessEnv
}

export async function upgrade(
  directory: string,
  currentVersion: string,
  {env}: UpgradeOptions = {env: process.env},
): Promise<void> {
  let newestVersion: string | void

  const projectDir = await getProjectDir(directory)
  if (projectDir) {
    newestVersion = await upgradeLocalShopify(projectDir, currentVersion)
  } else if (usingPackageManager({env})) {
    throw new AbortError(
      outputContent`Couldn't find an app toml file at ${outputToken.path(
        directory,
      )}, is this a Shopify project directory?`,
    )
  } else {
    newestVersion = await upgradeGlobalShopify(currentVersion, {env})
  }

  if (newestVersion) {
    outputSuccess(`Upgraded Shopify CLI to version ${newestVersion}`)
  }
}

async function getProjectDir(directory: string): Promise<string | undefined> {
  const configFiles = ['shopify.app{,.*}.toml', 'hydrogen.config.js', 'hydrogen.config.ts']
  const existsConfigFile = async (directory: string) => {
    const configPaths = await glob(configFiles.map((file) => joinPath(directory, file)))
    return configPaths.length > 0 ? configPaths[0] : undefined
  }
  const configFile = await findPathUp(existsConfigFile, {
    cwd: directory,
    type: 'file',
  })
  if (configFile) return dirname(configFile)
}

async function upgradeLocalShopify(projectDir: string, currentVersion: string): Promise<string | void> {
  const packageJson = (await findUpAndReadPackageJson(projectDir)).content
  const packageJsonDependencies = packageJson.dependencies || {}
  const packageJsonDevDependencies = packageJson.devDependencies || {}
  const allDependencies = {...packageJsonDependencies, ...packageJsonDevDependencies}

  let resolvedCLIVersion = allDependencies[await cliDependency()]!
  const resolvedAppVersion = allDependencies['@shopify/app']?.replace(/[\^~]/, '')

  if (resolvedCLIVersion.slice(0, 1).match(/[\^~]/)) resolvedCLIVersion = currentVersion
  const newestCLIVersion = await checkForNewVersion(await cliDependency(), resolvedCLIVersion)
  const newestAppVersion = resolvedAppVersion ? await checkForNewVersion('@shopify/app', resolvedAppVersion) : undefined

  if (newestCLIVersion) {
    outputUpgradeMessage(resolvedCLIVersion, newestCLIVersion)
  } else if (resolvedAppVersion && newestAppVersion) {
    outputUpgradeMessage(resolvedAppVersion, newestAppVersion)
  } else {
    outputWontInstallMessage(resolvedCLIVersion)
    return
  }

  await installJsonDependencies('prod', packageJsonDependencies, projectDir)
  await installJsonDependencies('dev', packageJsonDevDependencies, projectDir)
  return newestCLIVersion ?? newestAppVersion
}

async function upgradeGlobalShopify(
  currentVersion: string,
  {env}: UpgradeOptions = {env: process.env},
): Promise<string | void> {
  const newestVersion = await checkForNewVersion(await cliDependency(), currentVersion)

  if (!newestVersion) {
    outputWontInstallMessage(currentVersion)
    return
  }

  outputUpgradeMessage(currentVersion, newestVersion)

  const homebrewPackage = env.SHOPIFY_HOMEBREW_FORMULA as HomebrewPackageName | undefined
  try {
    if (homebrewPackage) {
      throw new AbortError(
        outputContent`Upgrade only works for packages managed by a Node package manager (e.g. npm). Run ${outputToken.genericShellCommand(
          'brew upgrade && brew update',
        )} instead`,
      )
    } else {
      await upgradeGlobalViaNpm()
    }
  } catch (err) {
    outputWarn('Upgrade failed!')
    throw err
  }
  return newestVersion
}

async function upgradeGlobalViaNpm(): Promise<void> {
  const command = 'npm'
  const args = [
    'install',
    '-g',
    `${await cliDependency()}@latest`,
    ...globalPlugins.map((plugin) => `${plugin}@latest`),
  ]
  outputInfo(
    outputContent`Attempting to upgrade via ${outputToken.genericShellCommand([command, ...args].join(' '))}...`,
  )
  await exec(command, args, {stdio: 'inherit'})
}

function outputWontInstallMessage(currentVersion: string): void {
  outputInfo(outputContent`You're on the latest version, ${outputToken.yellow(currentVersion)}, no need to upgrade!`)
}

function outputUpgradeMessage(currentVersion: string, newestVersion: string): void {
  outputInfo(
    outputContent`Upgrading CLI from ${outputToken.yellow(currentVersion)} to ${outputToken.yellow(newestVersion)}...`,
  )
}

async function installJsonDependencies(
  depsEnv: DependencyType,
  deps: {[key: string]: string},
  directory: string,
): Promise<void> {
  const packagesToUpdate = [await cliDependency(), ...(await oclifPlugins())]
    .filter((pkg: string): boolean => {
      const pkgRequirement: string | undefined = deps[pkg]
      return Boolean(pkgRequirement)
    })
    .map((pkg) => {
      return {name: pkg, version: 'latest'}
    })

  const appUsesWorkspaces = await usesWorkspaces(directory)

  if (packagesToUpdate.length > 0) {
    await addNPMDependencies(packagesToUpdate, {
      packageManager: await getPackageManager(directory),
      type: depsEnv,
      directory,
      stdout: process.stdout,
      stderr: process.stderr,
      addToRootDirectory: appUsesWorkspaces,
    })
  }
}

async function cliDependency(): Promise<string> {
  return (await packageJsonContents()).name
}

async function oclifPlugins(): Promise<string[]> {
  return (await packageJsonContents())?.oclif?.plugins || []
}

type PackageJsonWithName = Omit<PackageJson, 'name'> & {name: string}
let _packageJsonContents: PackageJsonWithName | undefined

async function packageJsonContents(): Promise<PackageJsonWithName> {
  if (!_packageJsonContents) {
    const packageJson = await findUpAndReadPackageJson(moduleDirectory(import.meta.url))
    _packageJsonContents = _packageJsonContents || (packageJson.content as PackageJsonWithName)
  }
  return _packageJsonContents
}

function usingPackageManager({env}: UpgradeOptions = {env: process.env}): boolean {
  return Boolean(env.npm_config_user_agent)
}
