import {skillsCommandForPackageManager} from './install.js'
import Command from '@shopify/cli-kit/node/base-command'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {Flags} from '@oclif/core'

// The skills CLI compares the recorded install hash against the remote source
// and only rewrites the skill when it has changed.
const shopifySkillUpdateArguments = ['update', 'shopify', '--global', '--yes']

export default class SkillUpdate extends Command {
  static summary = 'Update the Shopify skill for coding agents when its source has changed.'

  static flags = {
    'package-manager': Flags.string({
      description: 'The package manager to use to download the latest version of the skills CLI.',
      env: 'SHOPIFY_FLAG_PACKAGE_MANAGER',
      options: ['npm', 'pnpm', 'yarn', 'bun'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillUpdate)
    const packageManager = inferPackageManager(flags['package-manager'])
    const skillsCommand = skillsCommandForPackageManager(packageManager)

    await exec(skillsCommand.command, [...skillsCommand.args, ...shopifySkillUpdateArguments], {stdio: 'inherit'})
  }
}
