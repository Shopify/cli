import Command from '@shopify/cli-kit/node/base-command'
import {inferPackageManager, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {Flags} from '@oclif/core'

const shopifySkillArguments = ['add', 'Shopify/cli', '--skill', 'shopify', '--global', '--yes']

export default class SkillInstall extends Command {
  static summary = 'Install the Shopify skill for coding agents.'

  static flags = {
    'package-manager': Flags.string({
      description: 'The package manager to use to download the latest version of the skills CLI.',
      env: 'SHOPIFY_FLAG_PACKAGE_MANAGER',
      options: ['npm', 'pnpm', 'yarn', 'bun'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillInstall)
    const packageManager = inferPackageManager(flags['package-manager'])
    const skillsCommand = skillsCommandForPackageManager(packageManager)

    await exec(skillsCommand.command, [...skillsCommand.args, ...shopifySkillArguments], {stdio: 'inherit'})
  }
}

export function skillsCommandForPackageManager(packageManager: PackageManager): {command: string; args: string[]} {
  switch (packageManager) {
    case 'pnpm':
      return {command: 'pnpx', args: ['skills@latest']}
    case 'yarn':
      return {command: 'yarn', args: ['dlx', 'skills@latest']}
    case 'bun':
      return {command: 'bunx', args: ['skills@latest']}
    case 'npm':
    case 'homebrew':
    case 'unknown':
      return {command: 'npx', args: ['--yes', 'skills@latest']}
  }
}
