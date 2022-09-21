import {error, file, os, output, path, system} from '@shopify/cli-kit'
import {
  addNPMDependencies,
  findUpAndReadPackageJson,
  checkForNewVersion,
  DependencyType,
  getPackageManager,
} from '@shopify/cli-kit/node/node-package-manager'

// Canonical list of oclif plugins that should be installed globally
const globalPlugins = ['@shopify/theme']

interface PackageJsonContents {
  name: string
  dependencies?: {[name: string]: string}
  devDependencies?: {[name: string]: string}
  oclif?: {
    plugins?: string[]
  }
}

export async function upgrade(directory: string, currentVersion: string): Promise<void> {
  let newestVersion: string | void

  const projectDir = await getProjectDir(directory)
  if (projectDir) {
    newestVersion = await upgradeLocalShopify(projectDir, currentVersion)
  } else if (usingPackageManager()) {
    throw new error.Abort(
      output.content`Couldn't find the configuration file for ${output.token.path(
        directory,
      )}, are you in a Shopify project directory?`,
    )
  } else {
    newestVersion = await upgradeGlobalShopify(currentVersion)
  }

  if (newestVersion) {
    output.success(`Upgraded Shopify CLI to version ${newestVersion}`)
  }
}

async function getProjectDir(directory: string) {
  return path.findUp(
    async (dir: string) => {
      const configFilesExist = await Promise.all(
        ['shopify.app.toml', 'hydrogen.config.js', 'hydrogen.config.ts'].map(async (configFile) => {
          return file.exists(path.join(dir, configFile))
        }),
      )
      if (configFilesExist.some((bool) => bool)) return dir
    },
    {
      cwd: directory,
      type: 'directory',
    },
  )
}

async function upgradeLocalShopify(projectDir: string, currentVersion: string): Promise<string | void> {
  const packageJson = (await findUpAndReadPackageJson(projectDir)).content as PackageJsonContents
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

  const {platform} = os.platformAndArch()
  const isMacOS = platform.match(/darwin/)
  let usesHomebrew = false
  if (isMacOS) {
    try {
      const brewList = await system.captureOutput('brew', ['list', '-1'])
      usesHomebrew = Boolean(brewList.match(/^shopify-cli@3$/m))
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {}
  }

  try {
    await (usesHomebrew ? upgradeGlobalViaHomebrew() : upgradeGlobalViaNpm())
  } catch (err) {
    output.warn('Upgrade failed!')
    throw err
  }
  return newestVersion
}

async function upgradeGlobalViaHomebrew(): Promise<void> {
  output.info(
    output.content`Homebrew installation detected. Attempting to upgrade via ${output.token.genericShellCommand(
      'brew upgrade',
    )}...`,
  )
  await system.exec('brew', ['upgrade', 'shopify-cli@3'], {stdio: 'inherit'})
}

async function upgradeGlobalViaNpm(): Promise<void> {
  const command = 'npm'
  const args = [
    'install',
    '-g',
    `${await cliDependency()}@latest`,
    ...globalPlugins.map((plugin) => `${plugin}@latest`),
  ]
  output.info(
    output.content`Attempting to upgrade via ${output.token.genericShellCommand([command, ...args].join(' '))}...`,
  )
  await system.exec(command, args, {stdio: 'inherit'})
}

function outputWontInstallMessage(currentVersion: string): void {
  output.info(output.content`You're on the latest version, ${output.token.yellow(currentVersion)}, no need to upgrade!`)
}

function outputUpgradeMessage(currentVersion: string, newestVersion: string): void {
  output.info(
    output.content`Upgrading CLI from ${output.token.yellow(currentVersion)} to ${output.token.yellow(
      newestVersion,
    )}...`,
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

let _packageJsonContents: PackageJsonContents | undefined

async function packageJsonContents(): Promise<PackageJsonContents> {
  if (!_packageJsonContents) {
    const packageJson = await findUpAndReadPackageJson(path.moduleDirectory(import.meta.url))
    _packageJsonContents = _packageJsonContents || (packageJson.content as PackageJsonContents)
  }
  return _packageJsonContents
}

function usingPackageManager(): boolean {
  return Boolean(process.env.npm_config_user_agent)
}
