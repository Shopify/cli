import {Command} from '@oclif/core'
import {dependency, file, output, path} from '@shopify/cli-kit'

export default class Upgrade extends Command {
  static description = 'Upgrade the Shopify CLI'

  async run(): Promise<void> {
    const cliDependency = '@shopify/cli'
    const currentVersion = this.config.version
    output.info(output.content`Current ${Version.description}: ${output.token.yellow(currentVersion)}`.value)
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

    const projectDir = await path.findUp(async (dir) => {
      const configFilesExist = await Promise.all(
        ['shopify.app.toml', 'hydrogen.config.js', 'hydrogen.config.ts'].map(async (configFile) => {
          return file.exists(path.join(dir, configFile))
        }),
      )
      return configFilesExist.some((bool) => bool)
    })
    const packageJson = JSON.parse(await file.read(path.join(projectDir, 'package.json')))
    await Promise.all(
      [
        ['prod', packageJson.dependencies],
        ['dev', packageJson.devDependencies],
      ].map(async (env, deps) => {
        const packages = ['@shopify/cli', '@shopify/app', '@shopify/hydrogen', '@shopify/cli-hydrogen']
        const packagesToUpdate = packages.filter((package) => deps[package])

        await dependency.addLatestNPMDependencies(packagesToUpdate, {
          dependencyManager: dependency.dependencyManagerUsedForCreating(),
          type: env,
          directory: projectDir,
        })
      }),
    )
  }
}
