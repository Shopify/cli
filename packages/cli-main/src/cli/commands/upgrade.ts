import {Flags} from '@oclif/core'
import {error, file, output, path} from '@shopify/cli-kit'
import {
  addNPMDependencies,
  checkForNewVersion,
  DependencyType,
  getPackageManager,
} from '@shopify/cli-kit/node/node-package-manager'
import Command from '@shopify/cli-kit/node/base-command'
import {getCliProjectDir} from '@shopify/cli-kit/src/cli.js'

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
    const {flags} = await this.parse(Upgrade)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    const projectDir = await getCliProjectDir(directory)
    if (!projectDir) {
      throw new error.Abort(
        output.content`Couldn't find the configuration file for ${output.token.path(
          directory,
        )}, are you in a Shopify project directory?`,
      )
    }
    const packageJson = JSON.parse(await file.read(path.join(projectDir, 'package.json')))
    const packageJsonDependencies: {[key: string]: string} = packageJson.dependencies || {}
    const packageJsonDevDependencies: {[key: string]: string} = packageJson.devDependencies || {}

    const cliDependency = '@shopify/cli'
    let currentVersion: string = {...packageJsonDependencies, ...packageJsonDevDependencies}[cliDependency]!
    if (currentVersion.slice(0, 1).match(/[\^~]/)) currentVersion = this.config.version
    const newestVersion = await checkForNewVersion(cliDependency, currentVersion)

    if (!newestVersion) {
      output.info(
        output.content`You're on the latest version, ${output.token.yellow(currentVersion)}, no need to upgrade!`,
      )
      return
    }

    output.info(
      output.content`Upgrading CLI from ${output.token.yellow(currentVersion)} to ${output.token.yellow(
        newestVersion,
      )}...`,
    )

    await this.installJsonDependencies('prod', packageJsonDependencies, projectDir)
    await this.installJsonDependencies('dev', packageJsonDevDependencies, projectDir)

    output.success(`Upgraded Shopify CLI to version ${newestVersion}`)
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
}
