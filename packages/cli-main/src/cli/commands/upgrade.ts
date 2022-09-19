import {Flags} from '@oclif/core'
import {error, file, os, output, path, system} from '@shopify/cli-kit'
import {
  addNPMDependencies,
  checkForNewVersion,
  DependencyType,
  getPackageManager,
} from '@shopify/cli-kit/node/node-package-manager'
import Command from '@shopify/cli-kit/node/base-command'
const cliDependency = '@shopify/cli'

export default class Upgrade extends Command {
  static description = 'Upgrade the Shopify CLI'

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    let newestVersion: string | void

    const {flags} = await this.parse(Upgrade)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    const projectDir = await this.getProjectDir(directory)
    if (projectDir) {
      newestVersion = await this.upgradeLocalShopify(projectDir)
    } else if (this.usingPackageManager()) {
      throw new error.Abort(
        output.content`Couldn't find the configuration file for ${output.token.path(
          directory,
        )}, are you in a Shopify project directory?`,
      )
    } else {
      newestVersion = await this.upgradeGlobalShopify()
    }

    if (newestVersion) {
      output.success(`Upgraded Shopify CLI to version ${newestVersion}`)
    }
  }

  async getProjectDir(directory: string) {
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

  async upgradeLocalShopify(projectDir: string): Promise<string | void> {
    const packageJson = JSON.parse(await file.read(path.join(projectDir, 'package.json')))
    const packageJsonDependencies: {[key: string]: string} = packageJson.dependencies || {}
    const packageJsonDevDependencies: {[key: string]: string} = packageJson.devDependencies || {}

    let currentVersion: string = {...packageJsonDependencies, ...packageJsonDevDependencies}[cliDependency]!
    if (currentVersion.slice(0, 1).match(/[\^~]/)) currentVersion = this.getCurrentVersion()
    const newestVersion = await checkForNewVersion(cliDependency, currentVersion)

    if (!newestVersion) return this.wontInstall(currentVersion)

    this.outputUpgradeMessage(currentVersion, newestVersion)

    await this.installJsonDependencies('prod', packageJsonDependencies, projectDir)
    await this.installJsonDependencies('dev', packageJsonDevDependencies, projectDir)
    return newestVersion
  }

  async upgradeGlobalShopify(): Promise<string | void> {
    const currentVersion = this.getCurrentVersion()
    const newestVersion = await checkForNewVersion(cliDependency, currentVersion)

    if (!newestVersion) return this.wontInstall(currentVersion)

    this.outputUpgradeMessage(currentVersion, newestVersion)

    const {platform} = os.platformAndArch()
    if (platform.match(/darwin/)) {
      try {
        const brewList = await system.captureOutput('brew', ['list', '-1'])
        if (brewList.match(/^shopify-cli@3$/m)) {
          output.info(
            output.content`Homebrew installation detected. Attempting to upgrade via ${output.token.genericShellCommand('brew upgrade')}...`)
          await system.exec('brew', ['upgrade', 'shopify-cli@3'], { stdio: 'inherit' })
          return newestVersion
        }
      } catch(e) {
        output.warn('Homebrew upgrade failed. Falling back to standard npm install.')
      }
    }
    const command = 'npm'
    const args = ['install', '-g', '@shopify/cli@latest', '@shopify/theme@latest']
    output.info(
      output.content`Attempting to upgrade via ${output.token.genericShellCommand([command, ...args].join(' '))}...`)
    await system.exec(command, args, {stdio: 'inherit'})
    return newestVersion
  }

  wontInstall(currentVersion: string): void {
    output.info(
      output.content`You're on the latest version, ${output.token.yellow(currentVersion)}, no need to upgrade!`,
    )
  }

  outputUpgradeMessage(currentVersion: string, newestVersion: string): void {
    output.info(
      output.content`Upgrading CLI from ${output.token.yellow(currentVersion)} to ${output.token.yellow(
        newestVersion,
      )}...`,
    )
  }

  async installJsonDependencies(
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

  getCurrentVersion(): string {
    return this.config.version
  }

  usingPackageManager(): boolean {
    return Boolean(process.env.npm_config_user_agent)
  }
}
