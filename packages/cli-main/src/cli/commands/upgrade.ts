import {Command, Flags} from '@oclif/core'
import {dependency, error, file, output, path} from '@shopify/cli-kit'

type JSONDepsOpts = [dependency.DependencyType, {[key: string]: string}]

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

    const projectDir = await this.getProjectDir(directory)
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
    let currentVersion: string = {...packageJsonDependencies, ...packageJsonDevDependencies}[cliDependency]
    if (currentVersion.slice(0, 1).match(/[\^~]/)) currentVersion = this.config.version
    const newestVersion = await dependency.checkForNewVersion(cliDependency, currentVersion)

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

    await Promise.all(
      (
        [
          ['prod', packageJsonDependencies],
          ['dev', packageJsonDevDependencies],
        ] as JSONDepsOpts[]
      ).map(async (opts: JSONDepsOpts): Promise<void> => {
        const [depsEnv, deps] = opts
        const packages = ['@shopify/cli', '@shopify/app', '@shopify/hydrogen', '@shopify/cli-hydrogen']
        const packagesToUpdate = packages.filter((pkg: string): boolean => {
          const pkgRequirement: string | undefined = deps[pkg]
          return Boolean(pkgRequirement)
        })

        await dependency.addLatestNPMDependencies(packagesToUpdate, {
          dependencyManager: dependency.dependencyManagerUsedForCreating(),
          type: depsEnv,
          directory: projectDir,
        })
      }),
    )
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
}
