import Command from '@shopify/cli-kit/node/base-command'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {exec} from '@shopify/cli-kit/node/system'

export default class Init extends Command {
  static summary = 'Create a new hydrogen project'
  static strict = false
  static hidden = true

  async run(): Promise<void> {
    const args = ['exec', '@shopify/create-hydrogen']

    // Remove everything before the `init` command
    const initIndex = process.argv.indexOf('init')
    const flags = process.argv.slice(initIndex + 1)

    if (flags.length > 0) {
      args.push('--')
      args.push(...flags)
    }

    try {
      await exec('npm', args, {stdio: 'inherit'})
    } catch (error) {
      if (error instanceof Error && error.message.includes('SIGINT')) {
        outputInfo('Hydrogen init cancelled.')
      } else {
        throw error
      }
    }
  }
}
