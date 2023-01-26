import {
  addNPMDependencies,
  findUpAndReadPackageJson,
  checkForNewVersion,
  DependencyType,
  getPackageManager,
  PackageJson,
} from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {dirname, moduleDirectory} from '@shopify/cli-kit/node/path'
import {findPathUp} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputInfo, outputSuccess, outputToken, outputWarn} from '@shopify/cli-kit/node/output'

type HomebrewPackageName = 'shopify-cli' | 'shopify-cli@3'

// Canonical list of oclif plugins that should be installed globally
const globalPlugins = ['@shopify/theme']

export async function upgrade(directory: string, currentVersion: string): Promise<void> {
  let newestVersion: string | void

  const projectDir = await getProjectDir(directory)
  if (projectDir) {
    newestVersion = await upgradeLocalShopify(projectDir, currentVersion)
  } else if (usingPackageManager()) {
    throw new AbortError(
      outputContent`Couldn't find the configuration file for ${outputToken.path(
        directory,
      )}, are you in a Shopify project directory?`,
    )
  } else {
    newestVersion = await upgradeGlobalShopify(currentVersion)
  }

  if (newestVersion) {
    outputSuccess(`Upgraded Shopify CLI to version ${newestVersion}`)
  }
}

async function getProjectDir(directory: string): Promise<string | undefined> {
  const configFile = await findPathUp(['shopify.app.toml', 'hydrogen.config.js', 'hydrogen.config.ts'], {
    cwd: directory,
    type: 'file',
  })
  if (configFile) return dirname(configFile)
}

async function upgradeLocalShopify(projectDir: string, currentVersion: string): Promise<string | void> {
  const packageJson = (await findUpAndReadPackageJson(projectDir)).content
  const packageJsonDependencies = packageJson.dependencies || {}
  const packageJsonDevDependencies = packageJson.devDependencies || {}

  let resolvedVersion: string = {...packageJsonDependencies, ...packageJsonDevDependencies}[await cliDependency()]!
  if (resolvedVersion.slice(0, 1).match(/[\^~]/)) resolvedVersion = currentVersion
  const newestVersion = await checkForNewVersion(await cliDependency(), resolvedVersion)

  if (!newestVersion) {
    outputWontInstallMessage(resolvedVersion)
    return
  }

  outputUpgradeMessage(resolvedVersion, newestVersion)

  await installJsonDependencies('prod', packageJsonDependencies, projectDir)
  await installJsonDependencies('dev', packageJsonDevDependencies, projectDir)
  return newestVersion
}

async function upgradeGlobalShopify(currentVersion: string): Promise<string | void> {
  const newestVersion = await checkForNewVersion(await cliDependency(), currentVersion)

  if (!newestVersion) {
    outputWontInstallMessage(currentVersion)
    return
  }

  outputUpgradeMessage(currentVersion, newestVersion)

  const homebrewPackage = process.env.SHOPIFY_HOMEBREW_FORMULA as HomebrewPackageName | undefined
  try {
    await (homebrewPackage ? upgradeGlobalViaHomebrew(homebrewPackage) : upgradeGlobalViaNpm())
  } catch (err) {
    outputWarn('Upgrade failed!')
    throw err
  }
  return newestVersion
}

async function upgradeGlobalViaHomebrew(homebrewPackage: HomebrewPackageName): Promise<void> {
  outputInfo(
    outputContent`Homebrew installation detected. Attempting to upgrade via ${outputToken.genericShellCommand(
      'brew upgrade',
    )}...`,
  )
  await exec('brew', ['upgrade', homebrewPackage], {stdio: 'inherit'})
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

  if (packagesToUpdate.length > 0) {
    await addNPMDependencies(packagesToUpdate, {
      packageManager: await getPackageManager(directory),
      type: depsEnv,
      directory,
      stdout: process.stdout,
      stderr: process.stderr,
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

function usingPackageManager(): boolean {
  return Boolean(process.env.npm_config_user_agent)
}
