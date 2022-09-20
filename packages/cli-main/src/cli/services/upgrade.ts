import {error, file, os, output, path, system} from '@shopify/cli-kit'
import {
  addNPMDependencies,
  checkForNewVersion,
  DependencyType,
  getPackageManager,
} from '@shopify/cli-kit/node/node-package-manager'
import {fileURLToPath} from 'url'
const cliDependency: string = JSON.parse(
  file.readSync(path.resolve(fileURLToPath(import.meta.url), '../../../../package.json'))
).name

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
  const packageJson = JSON.parse(await file.read(path.join(projectDir, 'package.json')))
  const packageJsonDependencies: {[key: string]: string} = packageJson.dependencies || {}
  const packageJsonDevDependencies: {[key: string]: string} = packageJson.devDependencies || {}

  let resolvedVersion: string = {...packageJsonDependencies, ...packageJsonDevDependencies}[cliDependency]!
  if (resolvedVersion.slice(0, 1).match(/[\^~]/)) resolvedVersion = currentVersion
  const newestVersion = await checkForNewVersion(cliDependency, resolvedVersion)

  if (!newestVersion) return wontInstall(resolvedVersion)

  outputUpgradeMessage(resolvedVersion, newestVersion)

  await installJsonDependencies('prod', packageJsonDependencies, projectDir)
  await installJsonDependencies('dev', packageJsonDevDependencies, projectDir)
  return newestVersion
}

async function upgradeGlobalShopify(currentVersion: string): Promise<string | void> {
  const newestVersion = await checkForNewVersion(cliDependency, currentVersion)

  if (!newestVersion) return wontInstall(currentVersion)

  outputUpgradeMessage(currentVersion, newestVersion)

  const {platform} = os.platformAndArch()
  if (platform.match(/darwin/)) {
    try {
      const brewList = await system.captureOutput('brew', ['list', '-1'])
      if (brewList.match(/^shopify-cli@3$/m)) {
        output.info(
          output.content`Homebrew installation detected. Attempting to upgrade via ${output.token.genericShellCommand(
            'brew upgrade',
          )}...`,
        )
        await system.exec('brew', ['upgrade', 'shopify-cli@3'], {stdio: 'inherit'})
        return newestVersion
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      output.warn('Homebrew upgrade failed. Falling back to standard npm install.')
    }
  }
  const command = 'npm'
  const args = ['install', '-g', '@shopify/cli@latest', '@shopify/theme@latest']
  output.info(
    output.content`Attempting to upgrade via ${output.token.genericShellCommand([command, ...args].join(' '))}...`,
  )
  await system.exec(command, args, {stdio: 'inherit'})
  return newestVersion
}

function wontInstall(currentVersion: string): void {
  output.info(output.content`You're on the latest version, ${output.token.yellow(currentVersion)}, no need to upgrade!`)
}

function outputUpgradeMessage(currentVersion: string, newestVersion: string): void {
  output.info(
    output.content`Upgrading CLI from ${output.token.yellow(currentVersion)} to ${output.token.yellow(
      newestVersion,
    )}...`,
  )
}

export async function installJsonDependencies(
  depsEnv: DependencyType,
  deps: {[key: string]: string},
  directory: string,
): Promise<void> {
  const packages = ['@shopify/cli', '@shopify/app', '@shopify/cli-hydrogen']
  const packagesToUpdate = packages
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

function usingPackageManager(): boolean {
  return Boolean(process.env.npm_config_user_agent)
}
